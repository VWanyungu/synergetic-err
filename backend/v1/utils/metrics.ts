import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import client from 'prom-client';
import db from '../database/dbSetup.js';

export const registry = new client.Registry();
registry.setDefaultLabels({ app: 'err-backend' });
// Process metrics: CPU, resident memory, event-loop lag, open handles, GC.
client.collectDefaultMetrics({ register: registry });

const buckets = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const httpRequests = new client.Counter({
  name: 'http_requests_total',
  help: 'HTTP requests handled, by method, route pattern and status code.',
  labelNames: ['method', 'route', 'status'],
  registers: [registry],
});
const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds, by method, route pattern and status code.',
  labelNames: ['method', 'route', 'status'],
  buckets,
  registers: [registry],
});
const inFlight = new client.Gauge({ name: 'http_requests_in_flight', help: 'Requests being handled right now.', registers: [registry] });

/** Counted where the events happen (login, uploads) so a spike shows up without log parsing. */
export const loginAttempts = new client.Counter({ name: 'auth_login_attempts_total', help: 'Sign-in attempts by outcome.', labelNames: ['result'], registers: [registry] });
export const fileUploads = new client.Counter({ name: 'file_uploads_total', help: 'File uploads by storage provider and outcome.', labelNames: ['provider', 'result'], registers: [registry] });

// Database pool, read from knex's pool when scraped.
const pool = () => (db.client as unknown as { pool?: { numUsed(): number; numFree(): number; numPendingAcquires(): number; numPendingCreates(): number } }).pool;
new client.Gauge({
  name: 'db_pool_connections',
  help: 'Database pool connections by state.',
  labelNames: ['state'],
  registers: [registry],
  collect() {
    const p = pool();
    if (!p) return;
    this.set({ state: 'used' }, p.numUsed());
    this.set({ state: 'free' }, p.numFree());
    this.set({ state: 'pending_acquire' }, p.numPendingAcquires());
    this.set({ state: 'pending_create' }, p.numPendingCreates());
  },
});

// Business gauges, queried at scrape time. Three small aggregate queries every 15 to 60 seconds.
new client.Gauge({
  name: 'risks_total',
  help: 'Risks by status and rating band (archived risks excluded).',
  labelNames: ['status', 'band'],
  registers: [registry],
  async collect() {
    this.reset();
    const rows = await db('risks')
      .whereNull('archived_at')
      .select('status', db.raw(`case when rating >= 15 then 'high' when rating >= 9 then 'medium' else 'low' end as band`), db.raw('count(*)::int as n'))
      .groupBy('status', 'band');
    for (const r of rows) this.set({ status: r.status, band: r.band }, r.n);
  },
});
new client.Gauge({
  name: 'users_total',
  help: 'User accounts by status.',
  labelNames: ['status'],
  registers: [registry],
  async collect() {
    this.reset();
    const rows = await db('users').select<{ status: string; n: string }[]>('status', db.raw('count(*) as n')).groupBy('status');
    for (const r of rows) this.set({ status: r.status }, Number(r.n));
  },
});
new client.Gauge({
  name: 'mitigation_actions_overdue',
  help: 'Open mitigation actions past their due date.',
  registers: [registry],
  async collect() {
    const [row] = await db('mitigation_actions').whereNot('status', 'completed').whereRaw('due_date < current_date').count({ n: '*' });
    this.set(Number(row?.n ?? 0));
  },
});

/** Times every request except /metrics itself. The route label is the pattern ("/risks/:id"), never the raw URL, so cardinality stays bounded. */
export const trackRequests: RequestHandler = (req, res, next) => {
  if (req.path === '/metrics') return next();
  const end = httpDuration.startTimer();
  inFlight.inc();
  res.on('finish', () => {
    inFlight.dec();
    const route = req.route ? `${req.baseUrl}${String(req.route.path)}`.replace(/(.)\/$/, '$1') : 'unmatched';
    const labels = { method: req.method, route, status: String(res.statusCode) };
    httpRequests.inc(labels);
    end(labels);
  });
  next();
};

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** GET /metrics in the Prometheus text format. Needs `Authorization: Bearer $METRICS_TOKEN`. In production with no token set it is switched off rather than left open. */
export const metricsHandler: RequestHandler = async (req, res) => {
  const token = process.env.METRICS_TOKEN;
  if (!token) {
    if (process.env.NODE_ENV === 'production') {
      res.status(404).end();
      return;
    }
  } else if (!same(req.headers.authorization ?? '', `Bearer ${token}`)) {
    res.status(401).end();
    return;
  }
  try {
    res.set('Content-Type', registry.contentType).send(await registry.metrics());
  } catch {
    res.status(500).end();
  }
};
