import express from 'express';
import Joi from 'joi';
import db from '../database/dbSetup.js';
import { sendRouteError } from '../utils/errors.js';
import { applyFilters, base, csv, orderFor, ratingSql, registerColumns } from './risksRouter.js';
import { scopedDepartment } from '../utils/scope.js';

const router = express.Router();

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

type Row = { id: string; department_id: string; dept: string; category: string; rating: number; reviewed: boolean; has_plan: boolean; due: boolean };
type Group = { id: string; name: string; high: number; medium: number; low: number; total: number; sum: number };

const band = (rating: number) => (rating >= 15 ? 'high' : rating >= 9 ? 'medium' : 'low');

function group(rows: Row[], key: (r: Row) => [string, string]) {
  const groups = new Map<string, Group>();
  for (const r of rows) {
    const [id, name] = key(r);
    const g = groups.get(id) ?? { id, name, high: 0, medium: 0, low: 0, total: 0, sum: 0 };
    g[band(r.rating)]++;
    g.total++;
    g.sum += r.rating;
    groups.set(id, g);
  }
  return [...groups.values()]
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .map(({ sum, ...g }) => ({ ...g, avg: Math.round((sum / g.total) * 10) / 10 }));
}

// GET /dashboard/months — every month a report can be run for: from the first month with any rating history up to this month, newest first,
// with how many risks existed (not archived) at the end of each.
router.get('/months', async (_req, res) => {
  try {
    const first = await db('risk_rating_snapshots').min('month as first').first<{ first: string | null }>();
    const created: { created_at: Date }[] = await db('risks').whereNull('archived_at').select('created_at');
    const now = new Date();
    const last = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const start = first?.first ? new Date(`${String(first.first).slice(0, 7)}-01T00:00:00Z`).getTime() : last;
    const months: { month: string; total: number }[] = [];
    for (let t = start; t <= last; ) {
      const d = new Date(t);
      const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
      const total = created.filter((r) => r.created_at.getTime() < next).length;
      // A month with nothing on record has no report.
      if (total > 0) months.push({ month: d.toISOString().slice(0, 7), total });
      t = next;
    }
    res.status(200).json({ status: 'success', data: months.reverse(), message: 'Report months retrieved successfully' });
  } catch (err) {
    sendRouteError(res, err);
  }
});

// GET /dashboard?month=YYYY-MM&departmentId= — everything the dashboard shows, as at that month.
// shortcut: rows are aggregated in memory; fine for hundreds of risks, move to SQL group-bys if the register grows past that.
router.get('/', async (req, res) => {
  const { error, value } = querySchema.validate(req.query, { stripUnknown: true });
  if (error) {
    res.status(400).json({ status: 'error', data: null, message: error.message });
    return;
  }
  try {
    const userId = req.user!.userId;
    const [user, own] = await Promise.all([db('users').where({ id: userId }).first('first_name'), scopedDepartment(userId)]);
    const scoped = !!own;
    const departmentId: string | undefined = own ?? value.departmentId;

    const now = new Date();
    const month: string = value.month ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const [y, m] = month.split('-').map(Number) as [number, number];
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 1));
    const lastDay = new Date(end.getTime() - 86_400_000).toISOString().slice(0, 10);

    // Active and inactive (closed) risks both count; archived ones do not.
    const f = { departmentId, quick: [], status: 'all' as const, rating: [], month };
    const rating = ratingSql(month);

    const rows: Row[] = await applyFilters(base(), f, userId).select(
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
    );

    const topFilters = { ...f, rating: value.rating as string[], quick: value.archived ? ['archived'] : [], status: value.status as 'active' | 'inactive' | 'all', ownerId: value.ownerId, reviewMonth: value.reviewMonth, reviewState: value.reviewState };
    const top = await applyFilters(base(), topFilters, userId)
      .orderBy(orderFor(value.sort, rating))
      .limit(5)
      .select(registerColumns(rating));

    // A risk counts once for every division it affects.
    const links: { risk_id: string; division_id: string; name: string }[] = rows.length
      ? await db('risk_divisions as rd').join('divisions as d', 'd.id', 'rd.division_id').whereIn('rd.risk_id', rows.map((r) => r.id)).select('rd.risk_id', 'rd.division_id', 'd.name')
      : [];
    const byRisk = new Map(rows.map((r) => [r.id, r]));
    const divisionRows = links.map((l) => ({ ...byRisk.get(l.risk_id)!, division_id: l.division_id, division: l.name }));

    const total = rows.length;
    const reviewed = rows.filter((r) => r.reviewed).length;
    const withPlan = rows.filter((r) => r.has_plan).length;
    const levels = group(rows, () => ['all', 'All'])[0];

    const departments = await db('departments').select('id', 'name').orderBy('name').modify((q) => own && q.where('id', own));

    res.status(200).json({
      status: 'success',
      data: {
        firstName: user?.first_name ?? '',
        month,
        lastDay,
        scoped,
        departmentId: departmentId ?? '',
        departments,
        review: { total, reviewed, pending: total - reviewed, due: rows.filter((r) => !r.reviewed && r.due).length },
        coverage: { total, withPlan, noPlan: total - withPlan },
        levels: { total, high: levels?.high ?? 0, medium: levels?.medium ?? 0, low: levels?.low ?? 0 },
        breakdown: {
          department: group(rows, (r) => [r.department_id, r.dept]),
          category: group(rows, (r) => [r.category, r.category]),
          division: group(divisionRows, (r) => [(r as (typeof divisionRows)[number]).division_id, (r as (typeof divisionRows)[number]).division]),
        },
        top,
      },
      message: 'Dashboard retrieved successfully',
    });
  } catch (err) {
    sendRouteError(res, err);
  }
});

export default router;
