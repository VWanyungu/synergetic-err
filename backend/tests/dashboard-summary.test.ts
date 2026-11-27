import { describe, expect, test } from 'bun:test';
import db from '../v1/database/dbSetup.js';
import { period, summaryFor } from '../v1/routers/dashboardRouter.js';

// Needs migrated and seeded data (bun run migrate && bun run seed). summaryFor aggregates in SQL; this checks it
// against a plain in-JS count over the same risks, so a regression in the SQL shows up as a number that differs.

const band = (r: number) => (r >= 15 ? 'high' : r >= 9 ? 'medium' : 'low');

type Risk = { id: string; department_id: string; category: string; rating: number };

function count(risks: Risk[], key: (r: Risk) => string) {
  const out = new Map<string, { high: number; medium: number; low: number; total: number }>();
  for (const r of risks) {
    const g = out.get(key(r)) ?? { high: 0, medium: 0, low: 0, total: 0 };
    g[band(r.rating)]++;
    g.total++;
    out.set(key(r), g);
  }
  return out;
}

const pick = (g: { id: string; high: number; medium: number; low: number; total: number }[]) =>
  new Map(g.map(({ id, high, medium, low, total }) => [id, { high, medium, low, total }]));

describe('GET /dashboard/summary aggregation', () => {
  test('matches counts taken straight from the tables', async () => {
    const admin = await db('roles').where({ role: 'Admin' }).whereNull('revoked_at').first('user_id');
    expect(admin).toBeTruthy();
    const { month } = period();

    const risks: Risk[] = await db('risks as r')
      .whereNull('r.archived_at')
      .select('r.id', 'r.department_id', 'r.category', db.raw(`(select s.rating from risk_rating_snapshots s where s.risk_id = r.id and s.month <= ? order by s.month desc limit 1) as rating`, [`${month}-01`]))
      .then((rows: Risk[]) => rows.filter((r) => r.rating !== null));
    expect(risks.length).toBeGreaterThan(0);

    const summary = await summaryFor(admin.user_id, undefined, undefined);

    expect(summary.levels.total).toBe(risks.length);
    expect(summary.levels.high).toBe(risks.filter((r) => band(r.rating) === 'high').length);
    expect(summary.levels.low).toBe(risks.filter((r) => band(r.rating) === 'low').length);
    expect(pick(summary.breakdown.department)).toEqual(count(risks, (r) => r.department_id));
    expect(pick(summary.breakdown.category)).toEqual(count(risks, (r) => r.category));

    const links: { risk_id: string; division_id: string }[] = await db('risk_divisions').select('risk_id', 'division_id');
    const byId = new Map(risks.map((r) => [r.id, r]));
    const inDivision = links.filter((l) => byId.has(l.risk_id)).map((l) => ({ ...byId.get(l.risk_id)!, id: l.division_id }));
    expect(pick(summary.breakdown.division)).toEqual(count(inDivision, (r) => r.id));
  });

  test('breakdown rows are largest first', async () => {
    const admin = await db('roles').where({ role: 'Admin' }).whereNull('revoked_at').first('user_id');
    const { breakdown } = await summaryFor(admin.user_id, undefined, undefined);
    const totals = breakdown.department.map((d) => d.total);
    expect(totals).toEqual([...totals].sort((a, b) => b - a));
  });
});
