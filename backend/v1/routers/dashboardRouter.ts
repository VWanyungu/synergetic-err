import express from 'express';
import Joi from 'joi';
import type { Knex } from 'knex';
import db from '../database/dbSetup.js';
import { sendRouteError } from '../utils/errors.js';
import { applyFilters, base, csv, orderFor, ratingSql, registerColumns } from './risksRouter.js';
import { denyDivisionLead, scopedDepartment } from '../utils/scope.js';

const router = express.Router();
router.use(denyDivisionLead);

const querySchema = Joi.object({
  month: Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/).empty(''),
  departmentId: Joi.string().uuid().empty(''),
  // The highest-rated table's own column filters; the cards above ignore them.
  sort: Joi.string().valid('latest', 'rating_desc', 'rating_asc', 'reviewed', 'title', 'department', 'owner', 'status').default('rating_desc'),
  status: Joi.string().valid('active', 'inactive', 'all').default('all'),
  archived: Joi.boolean().default(false),
  rating: csv(['high', 'medium', 'low']).default([]),
  ownerId: Joi.string().uuid().empty(''),
  reviewMonth: Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/).empty(''),
  reviewState: csv(['reviewed', 'not_reviewed']).default([]),
});

type Group = { id: string; name: string; high: number; medium: number; low: number; total: number; avg: number };
type AggRow = { kind: 'all' | 'department' | 'category' | 'division'; id: string; name: string; high: number; medium: number; low: number; total: number; sum: number; reviewed: number; with_plan: number; due: number };

/** The month a request is about (default: this one) with the instants and last day its report is as at. */
export function period(requested?: string) {
  const now = new Date();
  const month: string = requested ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const [y, m] = month.split('-').map(Number) as [number, number];
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { month, start, end, lastDay: new Date(end.getTime() - 86_400_000).toISOString().slice(0, 10) };
}

const toGroup = ({ sum, ...g }: AggRow): Group => ({ id: g.id, name: g.name, high: g.high, medium: g.medium, low: g.low, total: g.total, avg: Math.round((sum / g.total) * 10) / 10 });
const biggestFirst = (a: Group, b: Group) => b.total - a.total || a.name.localeCompare(b.name);

// Every aggregate the dashboard cards need, as one SQL round trip: the filtered risks are computed once (materialized) and grouped four ways.
const AGG = `count(*)::int as total,
  count(*) filter (where rating >= 15)::int as high,
  count(*) filter (where rating >= 9 and rating < 15)::int as medium,
  count(*) filter (where rating < 9)::int as low,
  coalesce(sum(rating), 0)::int as sum,
  count(*) filter (where reviewed)::int as reviewed,
  count(*) filter (where has_plan)::int as with_plan,
  count(*) filter (where not reviewed and due)::int as due`;

/** Everything on the dashboard except the highest-rated table: counts and breakdowns, as at `month`. */
export async function summaryFor(userId: string, month: string | undefined, requestedDepartment: string | undefined) {
  const [user, own] = await Promise.all([db('users').where({ id: userId }).first('first_name'), scopedDepartment(userId)]);
  const departmentId: string | undefined = own ?? requestedDepartment;
  const { month: m, start, end, lastDay } = period(month);

  // Active and inactive (closed) risks both count; archived ones do not.
  const rating = ratingSql(m);
  const rows = applyFilters(base(), { departmentId, quick: [], status: 'all', rating: [], month: m }, userId)
    .select(
      'r.id',
      'r.department_id',
      'd.name as dept',
      'r.category',
      db.raw(`${rating} as rating`),
      db.raw(
        `(exists(select 1 from risk_activity a where a.risk_id = r.id and a.type = 'reviewed' and a.created_at >= :s and a.created_at < :e)
          or (r.last_reviewed_at >= :s and r.last_reviewed_at < :e)) as reviewed`,
        { s: start, e: end },
      ),
      db.raw(`exists(select 1 from mitigation_actions a where a.risk_id = r.id and a.created_at < :e) as has_plan`, { e: end }),
      db.raw(`(r.next_review_date is not null and r.next_review_date <= :d) as due`, { d: lastDay }),
    )
    .toSQL();

  const [agg, departments] = await Promise.all([
    db.raw(
      `with rows as materialized (${rows.sql})
       select 'all' as kind, 'all' as id, 'All' as name, ${AGG} from rows
       union all select 'department', department_id::text, dept, ${AGG} from rows group by department_id, dept
       union all select 'category', category, category, ${AGG} from rows group by category
       union all select 'division', rd.division_id::text, dv.name, ${AGG}
         from rows join risk_divisions rd on rd.risk_id = rows.id join divisions dv on dv.id = rd.division_id group by rd.division_id, dv.name`,
      rows.bindings as Knex.RawBinding[],
    ) as Promise<{ rows: AggRow[] }>,
    db('departments').select('id', 'name').orderBy('name').modify((q) => own && q.where('id', own)),
  ]);

  const of = (kind: AggRow['kind']) => agg.rows.filter((r) => r.kind === kind).map(toGroup).sort(biggestFirst);
  const all = agg.rows.find((r) => r.kind === 'all')!;
  return {
    firstName: user?.first_name ?? '',
    month: m,
    lastDay,
    scoped: !!own,
    departmentId: departmentId ?? '',
    departments,
    review: { total: all.total, reviewed: all.reviewed, pending: all.total - all.reviewed, due: all.due },
    coverage: { total: all.total, withPlan: all.with_plan, noPlan: all.total - all.with_plan },
    levels: { total: all.total, high: all.high, medium: all.medium, low: all.low },
    breakdown: { department: of('department'), category: of('category'), division: of('division') },
  };
}

type TableQuery = { month?: string; departmentId?: string; sort: string; status: 'active' | 'inactive' | 'all'; archived: boolean; rating: string[]; ownerId?: string; reviewMonth?: string; reviewState: string[] };

/** The five highest-rated risks (under the table's own filters) with their mitigation plans. */
export async function topFor(userId: string, v: TableQuery) {
  const own = await scopedDepartment(userId);
  const { month, end } = period(v.month);
  const rating = ratingSql(month);
  const filters = { departmentId: own ?? v.departmentId, month, quick: v.archived ? ['archived'] : [], status: v.status, rating: v.rating, ownerId: v.ownerId, reviewMonth: v.reviewMonth, reviewState: v.reviewState };
  const top = await applyFilters(base(), filters, userId).orderBy(orderFor(v.sort, rating)).limit(5).select(registerColumns(rating));

  // Plans are not snapshotted (only ratings are), so a past month is rebuilt: plans that existed by month end, with the status
  // they had then, taken from the first status change after it. shortcut: events are matched by plan title (the log stores no plan id),
  // so a plan renamed after month end shows its current status; add plan_id to the event if that matters.
  const ids = top.map((t: { id: string }) => t.id);
  const [plans, later] = ids.length
    ? await Promise.all([
        db('mitigation_actions as a')
          .leftJoin('users as u', 'u.id', 'a.owner_id')
          .whereIn('a.risk_id', ids)
          .where('a.created_at', '<', end)
          .orderBy('a.created_at')
          .select('a.risk_id', 'a.title', 'a.status', db.raw(`to_char(a.due_date, 'YYYY-MM-DD') as due_date`), db.raw(`nullif(trim(concat(u.first_name, ' ', u.last_name)), '') as owner`)),
        db('risk_activity').whereIn('risk_id', ids).where({ type: 'mitigation_status' }).where('created_at', '>=', end).orderBy('created_at').select('risk_id', 'data'),
      ])
    : [[], []];
  const planStatus = (risk: string, title: string, current: string) =>
    (later as { risk_id: string; data: { plan: string; from: string } }[]).find((e) => e.risk_id === risk && e.data.plan === title)?.data.from ?? current;
  return top.map((t: { id: string }) => ({
    ...t,
    plans: (plans as { risk_id: string; title: string; status: string; due_date: string | null; owner: string | null }[])
      .filter((p) => p.risk_id === t.id)
      .map((p) => ({ title: p.title, status: planStatus(p.risk_id, p.title, p.status), dueDate: p.due_date, owner: p.owner })),
  }));
}

// GET /dashboard/months — every month a report can be run for: from the first month with any rating history up to this month, newest first,
// with how many risks existed (not archived) at the end of each.
router.get('/months', async (_req, res) => {
  try {
    const [first, created] = await Promise.all([
      db('risk_rating_snapshots').min('month as first').first<{ first: string | null }>(),
      db('risks').whereNull('archived_at').groupByRaw(`to_char(created_at at time zone 'UTC', 'YYYY-MM')`).select(db.raw(`to_char(created_at at time zone 'UTC', 'YYYY-MM') as month`), db.raw('count(*)::int as n')),
    ]);
    const perMonth = new Map((created as { month: string; n: number }[]).map((c) => [c.month, c.n]));
    const firstMonth = Math.min(...[...perMonth.keys()].map((k) => Date.parse(`${k}-01T00:00:00Z`)));
    const now = new Date();
    const last = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const start = first?.first ? new Date(`${String(first.first).slice(0, 7)}-01T00:00:00Z`).getTime() : last;
    const months: { month: string; total: number }[] = [];
    // Running total from the earliest risk, so a month's count is every risk created before the next month starts.
    let total = 0;
    for (let t = Math.min(start, firstMonth); t <= last; ) {
      const d = new Date(t);
      const key = d.toISOString().slice(0, 7);
      total += perMonth.get(key) ?? 0;
      // A month with nothing on record has no report.
      if (t >= start && total > 0) months.push({ month: key, total });
      t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    }
    res.status(200).json({ status: 'success', data: months.reverse(), message: 'Report months retrieved successfully' });
  } catch (err) {
    sendRouteError(res, err);
  }
});

function parse(req: express.Request, res: express.Response) {
  const { error, value } = querySchema.validate(req.query, { stripUnknown: true });
  if (error) {
    res.status(400).json({ status: 'error', data: null, message: error.message });
    return null;
  }
  return value as TableQuery;
}

// The dashboard page asks for these two separately so the cards can render while the table is still loading.
// GET /dashboard/summary?month=YYYY-MM&departmentId= — counts and breakdowns, as at that month.
router.get('/summary', async (req, res) => {
  const v = parse(req, res);
  if (!v) return;
  try {
    res.status(200).json({ status: 'success', data: await summaryFor(req.user!.userId, v.month, v.departmentId), message: 'Dashboard summary retrieved successfully' });
  } catch (err) {
    sendRouteError(res, err);
  }
});

// GET /dashboard/top — the Highest rated risks table, under its own sort and column filters.
router.get('/top', async (req, res) => {
  const v = parse(req, res);
  if (!v) return;
  try {
    res.status(200).json({ status: 'success', data: { top: await topFor(req.user!.userId, v) }, message: 'Highest rated risks retrieved successfully' });
  } catch (err) {
    sendRouteError(res, err);
  }
});

// GET /dashboard — both together, for the printed report.
router.get('/', async (req, res) => {
  const v = parse(req, res);
  if (!v) return;
  try {
    const [summary, top] = await Promise.all([summaryFor(req.user!.userId, v.month, v.departmentId), topFor(req.user!.userId, v)]);
    res.status(200).json({ status: 'success', data: { ...summary, top }, message: 'Dashboard retrieved successfully' });
  } catch (err) {
    sendRouteError(res, err);
  }
});

export default router;
