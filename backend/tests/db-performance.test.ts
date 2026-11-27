import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Knex } from 'knex';
import db from '../v1/database/dbSetup.js';

// Needs a migrated Postgres (see .github/workflows/test.yml). Bulk rows are inserted inside
// a transaction that is rolled back, so the database is left untouched.
const ROWS = 5000;

type PlanNode = { 'Node Type': string; 'Relation Name'?: string; Plans?: PlanNode[] };

function nodes(plan: PlanNode): PlanNode[] {
  return [plan, ...(plan.Plans ?? []).flatMap(nodes)];
}

// Seq scans are switched off so the test asks "can an index serve this query?" rather than "does the
// planner prefer it at this row count" (a GIN trigram scan costs more than scanning a few thousand small rows).
async function explain(trx: Knex.Transaction, sql: string, bindings: unknown[] = []): Promise<PlanNode[]> {
  await trx.raw('set local enable_seqscan = off');
  const res = await trx.raw(`explain (format json) ${sql}`, bindings as Knex.RawBinding[]);
  await trx.raw('set local enable_seqscan = on');
  return nodes(res.rows[0]['QUERY PLAN'][0].Plan);
}

const seqScans = (plan: PlanNode[], table: string) =>
  plan.filter((n) => n['Node Type'] === 'Seq Scan' && n['Relation Name'] === table);


describe('schema', () => {
  test('every foreign key column has an index that leads with it', async () => {
    const { rows } = await db.raw(`
      select c.conrelid::regclass::text as tbl, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f' and c.connamespace = 'public'::regnamespace
        and not exists (
          select 1 from pg_index i
          where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1] and i.indpred is null)
      order by 1, 2`);
    expect(rows.map((r: { tbl: string; col: string }) => `${r.tbl}.${r.col}`)).toEqual([]);
  });
});

describe(`query plans at ${ROWS} rows`, () => {
  let trx: Knex.Transaction;
  let departmentId: string;

  beforeAll(async () => {
    trx = await db.transaction();
    [{ id: departmentId }] = await trx('departments').insert({ name: 'perf-test', code: 'PF' }).returning('id');

    // Random text so the searches below match only the few rows planted at the end.
    await trx.raw(
      `insert into risks (title, category, department_id, likelihood, impact, code, created_at)
       select md5(g::text), md5((g + 1)::text), ?, 1 + g % 5, 1 + (g / 5) % 5, 'P' || g, now() - g * interval '1 minute'
       from generate_series(1, ?) g`,
      [departmentId, ROWS],
    );
    await trx('risks').insert({
      title: 'zebra outage', category: 'Operational', department_id: departmentId, likelihood: 3, impact: 3, code: 'PZ1',
    });
    await trx.raw(
      `insert into mitigation_actions (risk_id, title, status, due_date)
       select id, md5(code), case when random() < 0.9 then 'completed' else 'in_progress' end, current_date - 10
       from risks where department_id = ?`,
      [departmentId],
    );
    await trx.raw(
      `insert into mitigation_actions (risk_id, title, status) select id, 'patch zebra', 'in_progress' from risks where code = 'PZ1'`,
    );
    await trx.raw('analyze risks, mitigation_actions');
  });

  afterAll(() => trx.rollback());

  test('title search (ILIKE) does not seq scan risks', async () => {
    const plan = await explain(trx, `select id from risks where title ilike '%zebra%' or code ilike '%zebra%' or category ilike '%zebra%'`);
    expect(seqScans(plan, 'risks')).toEqual([]);
  });

  test('mitigation action search does not seq scan mitigation_actions', async () => {
    const plan = await explain(trx, `select id from mitigation_actions where title ilike '%zebra%'`);
    expect(seqScans(plan, 'mitigation_actions')).toEqual([]);
  });

  test('register default sort (newest first) needs no Sort node', async () => {
    const plan = await explain(trx, `select id from risks where archived_at is null order by created_at desc limit 8`);
    expect(plan.map((n) => n['Node Type'])).not.toContain('Sort');
  });

  test('register sort by rating needs no Sort node', async () => {
    const plan = await explain(trx, `select id from risks where archived_at is null order by rating desc, title limit 8`);
    expect(plan.map((n) => n['Node Type'])).not.toContain('Sort');
  });
});
