import { readFileSync } from 'node:fs';
import type { RequestHandler } from 'express';
import db from '../database/dbSetup.js';
import redis, { cacheProvider } from '../database/cacheSetup.js';
import { isStorageConfigured } from './storage.js';

const started = Date.now();
const version = process.env.APP_VERSION || (JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string }).version;

type Check = { status: 'ok' | 'error' | 'not_configured'; latencyMs?: number } & Record<string, unknown>;

/** A dependency that hangs must not hang the health check: give up after two seconds. */
const timed = async (probe: () => Promise<Record<string, unknown> | void>): Promise<Check> => {
  const t = performance.now();
  try {
    const extra = await Promise.race([probe(), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))]);
    return { status: 'ok', latencyMs: Math.round(performance.now() - t), ...(extra ?? {}) };
  } catch {
    return { status: 'error', latencyMs: Math.round(performance.now() - t) };
  }
};

// Reading the migrations folder on every probe would be wasteful; a minute-old answer is plenty.
let migrations: { at: number; applied: number; pending: number } | null = null;
const migrationState = async (): Promise<{ applied: number; pending: number }> => {
  if (!migrations || Date.now() - migrations.at > 60_000) {
    const [done, pending] = await db.migrate.list();
    migrations = { at: Date.now(), applied: done.length, pending: pending.length };
  }
  return { applied: migrations.applied, pending: migrations.pending };
};

/**
 * GET /health: what a person or a monitor needs to know in one call.
 *   ok        everything works
 *   degraded  serving, but something needs attention (uploads or mail not configured, a migration not applied)
 *   down      the database or cache is unreachable: 503, so load balancers and Docker take it out of rotation
 * Only counts and latencies are reported, never error text, hostnames or secrets.
 */
export const health: RequestHandler = async (_req, res) => {
  const [database, migrationCheck, cache] = await Promise.all([
    timed(async () => {
      await db.raw('select 1');
    }),
    timed(migrationState),
    timed(async () => {
      await redis.set('health:ping', Date.now(), { ex: 10 });
      if ((await redis.get('health:ping')) === null) throw new Error('cache did not return what was written');
    }),
  ]);
  const storage: Check = { status: isStorageConfigured() ? 'ok' : 'not_configured', provider: process.env.NODE_ENV === 'production' ? 'r2' : 'cloudinary' };
  const mail: Check = { status: process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD ? 'ok' : 'not_configured' };

  const pending = typeof migrationCheck.pending === 'number' && migrationCheck.pending > 0;
  const status = database.status === 'error' || cache.status === 'error' ? 'down' : storage.status !== 'ok' || mail.status !== 'ok' || migrationCheck.status !== 'ok' || pending ? 'degraded' : 'ok';

  res.status(status === 'down' ? 503 : 200).json({
    status,
    version,
    environment: process.env.NODE_ENV || 'development',
    uptimeSeconds: Math.round((Date.now() - started) / 1000),
    timestamp: new Date().toISOString(),
    checks: { database: { ...database, migrations: migrationCheck }, cache: { ...cache, provider: cacheProvider }, storage, mail },
  });
};

/** GET /health/live: the process is up. For restart decisions only: it deliberately checks nothing else, so a database outage does not cause restart loops. */
export const live: RequestHandler = (_req, res) => {
  res.status(200).json({ status: 'ok' });
};
