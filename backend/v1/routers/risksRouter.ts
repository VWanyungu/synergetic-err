import express from 'express';
import Joi from 'joi';
import type { Knex } from 'knex';
import db from '../database/dbSetup.js';
import { sendRouteError } from '../utils/errors.js';
import { scopedDepartment } from '../utils/scope.js';

const router = express.Router();

const QUICK = ['noMitigation', 'dueForReview', 'myRisks', 'archived', 'highRisk', 'unassigned', 'overdueActions', 'changedThisWeek'] as const;
export const csv = (valid: readonly string[]) =>
  Joi.string()
    .empty('')
    .custom((v: string, helpers) => {
      const parts = v.split(',').filter(Boolean);
      return parts.every((p) => valid.includes(p)) ? parts : helpers.error('any.invalid');
    });

const registerQuerySchema = Joi.object({
  departmentId: Joi.string().uuid().empty(''),
  divisionId: Joi.string().uuid().empty(''),
  q: Joi.string().trim().max(100).empty(''),
  quick: csv(QUICK).default([]),
  status: Joi.string().valid('active', 'inactive', 'all').default('all'),
  category: Joi.string().max(100).empty(''),
  rating: csv(['high', 'medium', 'low']).default([]),
  month: Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/).empty(''),
  ownerId: Joi.string().uuid().empty(''),
  response: Joi.string().valid('accept', 'mitigate', 'transfer', 'avoid').empty(''),
  reviewMonth: Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/).empty(''),
  reviewState: csv(['reviewed', 'not_reviewed']).default([]),
  sort: Joi.string().valid('latest', 'rating_desc', 'rating_asc', 'reviewed', 'title', 'department', 'owner', 'status').default('latest'),
  page: Joi.number().integer().min(1).default(1),
  perPage: Joi.number().integer().min(1).max(100).default(8),
});

type RegisterFilters = {
  departmentId?: string;
  divisionId?: string;
  q?: string;
  quick: string[];
  status: 'active' | 'inactive' | 'all';
  category?: string;
  rating: string[];
  month?: string;
  ownerId?: string;
  response?: string;
  reviewMonth?: string;
  reviewState?: string[];
};

// shortcut: "due for review" is a fixed 90 days since the last review; make it a setting when the review cycle (FR-REVIEW) is specced.
const REVIEW_CYCLE_DAYS = 90;

/** The rating the register shows: today's, or (with a month) the latest snapshot at or before that month. Month is regex-validated, so inlining it is safe. */
export const ratingSql = (month?: string) =>
  month ? `(select s.rating from risk_rating_snapshots s where s.risk_id = r.id and s.month <= '${month}-01' order by s.month desc limit 1)` : 'r.rating';

/** Applies every register filter except those named in `omit`, so each facet can count against the others. */
export function applyFilters(q: Knex.QueryBuilder, f: RegisterFilters, userId: string, omit: 'department' | 'rating' | null = null) {
  q.where((w) => (f.quick.includes('archived') ? w.whereNotNull('r.archived_at') : w.whereNull('r.archived_at')));
  if (f.departmentId && omit !== 'department') q.where('r.department_id', f.departmentId);
  if (f.status === 'active') q.whereIn('r.status', ['open', 'in_progress']);
  if (f.status === 'inactive') q.where('r.status', 'closed');
  if (f.category) q.where('r.category', f.category);
  if (f.q) {
    const like = `%${f.q.replace(/[%_\\]/g, '\\$&')}%`;
    q.where((w) =>
      w
        .whereILike('r.title', like)
        .orWhereILike('r.code', like)
        .orWhereILike('r.category', like)
        .orWhereRaw(`concat(u.first_name, ' ', u.last_name) ilike ?`, [like]),
    );
  }
  const rating = ratingSql(f.month);
  // shortcut: a month shows each risk's rating then; status, owner and archive state stay as they are today.
  if (f.month) q.whereRaw(`${rating} is not null`);
  if (f.rating.length && omit !== 'rating') {
    q.where((w) => {
      if (f.rating.includes('high')) w.orWhereRaw(`${rating} >= 15`);
      if (f.rating.includes('medium')) w.orWhereRaw(`${rating} between 9 and 14`);
      if (f.rating.includes('low')) w.orWhereRaw(`${rating} <= 8`);
    });
  }
  // A division is a department a risk affects (risk_divisions), as opposed to the department that owns it.
  if (f.divisionId) q.whereExists(db('risk_divisions as rd').whereRaw('rd.risk_id = r.id').where('rd.department_id', f.divisionId));
  if (f.ownerId) q.where('r.owner_id', f.ownerId);
  if (f.response) q.where('r.risk_response', f.response);
  // Exactly one box ticked filters; both or neither means no review filter.
  if (f.reviewState?.length === 1) {
    let reviewed = 'r.last_reviewed_at is not null';
    let bindings: Date[] = [];
    if (f.reviewMonth) {
      const [y, m] = f.reviewMonth.split('-').map(Number) as [number, number];
      const from = new Date(Date.UTC(y, m - 1, 1));
      const to = new Date(Date.UTC(y, m, 1));
      // Reviewed in the month: a logged review event, or the latest review date, falls inside it.
      reviewed = `(exists(select 1 from risk_activity a where a.risk_id = r.id and a.type = 'reviewed' and a.created_at >= ? and a.created_at < ?) or (r.last_reviewed_at >= ? and r.last_reviewed_at < ?))`;
      bindings = [from, to, from, to];
    }
    q.whereRaw(f.reviewState[0] === 'not_reviewed' ? `not coalesce(${reviewed}, false)` : reviewed, bindings);
  }
  for (const k of f.quick) {
    if (k === 'highRisk') q.whereRaw(`${rating} >= 15`);
    if (k === 'unassigned') q.whereNull('r.owner_id');
    if (k === 'myRisks') q.where('r.owner_id', userId);
    if (k === 'changedThisWeek') q.whereRaw(`r.updated_at >= now() - interval '7 days'`);
    if (k === 'dueForReview')
      q.whereRaw(`(r.last_reviewed_at is null or r.last_reviewed_at < now() - interval '${REVIEW_CYCLE_DAYS} days')`);
    if (k === 'noMitigation') q.whereNotExists(db('mitigation_actions as a').whereRaw('a.risk_id = r.id'));
    if (k === 'overdueActions')
      q.whereExists(
        db('mitigation_actions as a').whereRaw('a.risk_id = r.id').where('a.status', '<>', 'completed').whereRaw('a.due_date < current_date'),
      );
  }
  return q;
}

export const base = () => db('risks as r').join('departments as d', 'd.id', 'r.department_id').leftJoin('users as u', 'u.id', 'r.owner_id');

export const registerColumns = (rating: string) => [
        'r.id',
        'r.code',
        'r.title',
        'r.category',
        'r.likelihood',
        'r.impact',
        db.raw(`${rating} as rating`),
        'r.status',
        'r.risk_response as riskResponse',
        'r.last_reviewed_at as lastReviewedAt',
        'r.archived_at as archivedAt',
        'd.id as departmentId',
        'd.name as department',
        db.raw(`nullif(trim(concat(u.first_name, ' ', u.last_name)), '') as owner`),
];

type OrderBy = { column: string; order?: 'asc' | 'desc'; nulls?: 'first' | 'last' };
const ORDER: Record<string, OrderBy[]> = {
  latest: [{ column: 'r.created_at', order: 'desc' }],
  rating_desc: [{ column: 'r.rating', order: 'desc' }, { column: 'r.title' }],
  rating_asc: [{ column: 'r.rating', order: 'asc' }, { column: 'r.title' }],
  reviewed: [{ column: 'r.last_reviewed_at', order: 'desc', nulls: 'last' }, { column: 'r.title' }],
  title: [{ column: 'r.title' }],
  department: [{ column: 'd.name' }, { column: 'r.code' }],
  owner: [{ column: 'owner', nulls: 'last' }, { column: 'r.code' }],
  status: [{ column: 'r.status' }, { column: 'r.code' }],
};

/** Rating sorts follow the snapshot rating when a month is chosen. */
export const orderFor = (sort: string, rating: string) =>
  (ORDER[sort] ?? ORDER.latest!).map((o) => (o.column === 'r.rating' ? { ...o, column: db.raw(rating) as unknown as string } : o));

// GET /risks/register — filtered, sorted, paginated list plus the facet counts the register's controls show.
router.get('/register', async (req, res) => {
  const { error, value } = registerQuerySchema.validate(req.query, { abortEarly: false, stripUnknown: true });
  if (error) {
    res.status(400).json({ status: 'error', data: null, message: error.message });
    return;
  }
  const f = value as RegisterFilters & { sort: string; page: number; perPage: number };
  const userId = req.user!.userId;
  // A Risk Champion only ever sees their own department's register, or the risks affecting their own division, whatever the request asks for.
  const own = await scopedDepartment(userId);
  if (own) {
    if (f.divisionId) f.divisionId = own;
    else f.departmentId = own;
  }

  try {
    const [totalRow] = await applyFilters(base(), f, userId).count<{ count: string }[]>('r.id as count');
    const rating = ratingSql(f.month);
    const order = orderFor(f.sort, rating);
    const items = await applyFilters(base(), f, userId)
      .orderBy(order)
      .limit(f.perPage)
      .offset((f.page - 1) * f.perPage)
      .select(registerColumns(rating));

    const departments: { id: string; count: number }[] = await applyFilters(base(), f, userId, 'department')
      .groupBy('d.id')
      .select('d.id', db.raw('count(*)::int as count'));
    const ratings = await applyFilters(base(), f, userId, 'rating').select(
      db.raw(`count(*) filter (where ${rating} >= 15)::int as high`),
      db.raw(`count(*) filter (where ${rating} between 9 and 14)::int as medium`),
      db.raw(`count(*) filter (where ${rating} <= 8)::int as low`),
    );
    const categories = await db('risks').distinct('category').orderBy('category').pluck('category');

    res.status(200).json({
      status: 'success',
      data: {
        items,
        total: Number(totalRow?.count ?? 0),
        page: f.page,
        perPage: f.perPage,
        facets: {
          departments: Object.fromEntries(departments.map((d) => [d.id, d.count])),
          ratings: ratings[0],
          categories,
        },
      },
      message: 'Risks retrieved successfully',
    });
  } catch (err) {
    sendRouteError(res, err);
  }
});

// GET /risks/registers — one row per department for the All registers page: active, unarchived risks split by rating band.
router.get('/registers', async (req, res) => {
  try {
    const own = await scopedDepartment(req.user!.userId);
    const rows = await db('departments as d')
      .modify((q) => own && q.where('d.id', own))
      .leftJoin('risks as r', function () {
        this.on('r.department_id', 'd.id').andOnNull('r.archived_at').andOnIn('r.status', ['open', 'in_progress']);
      })
      .groupBy('d.id')
      .orderBy('d.name')
      .select(
        'd.id',
        'd.name',
        'd.code',
        'd.description',
        db.raw('count(r.id)::int as total'),
        db.raw('count(r.id) filter (where r.rating >= 15)::int as high'),
        db.raw('count(r.id) filter (where r.rating between 9 and 14)::int as medium'),
        db.raw('count(r.id) filter (where r.rating <= 8)::int as low'),
      );
    res.status(200).json({ status: 'success', data: rows, message: 'Registers retrieved successfully' });
  } catch (err) {
    sendRouteError(res, err);
  }
});

// GET /risks/divisions — like /registers, but counting the risks that affect each department rather than the ones it owns.
router.get('/divisions', async (req, res) => {
  try {
    const own = await scopedDepartment(req.user!.userId);
    const rows = await db('departments as d')
      .modify((q) => own && q.where('d.id', own))
      .leftJoin('risk_divisions as rd', 'rd.department_id', 'd.id')
      .leftJoin('risks as r', function () {
        this.on('r.id', 'rd.risk_id').andOnNull('r.archived_at').andOnIn('r.status', ['open', 'in_progress']);
      })
      .groupBy('d.id')
      .orderBy('d.name')
      .select(
        'd.id',
        'd.name',
        'd.code',
        db.raw('null as description'),
        db.raw('count(r.id)::int as total'),
        db.raw('count(r.id) filter (where r.rating >= 15)::int as high'),
        db.raw('count(r.id) filter (where r.rating between 9 and 14)::int as medium'),
        db.raw('count(r.id) filter (where r.rating <= 8)::int as low'),
      );
    res.status(200).json({ status: 'success', data: rows, message: 'Divisions retrieved successfully' });
  } catch (err) {
    sendRouteError(res, err);
  }
});

// GET /risks/form-options — what the New risk form needs besides departments.
router.get('/form-options', async (req, res) => {
  try {
    const [cats, owners] = await Promise.all([
      db('risks').distinct('category').orderBy('category'),
      db('users')
        .select('id', db.raw(`trim(concat(first_name, ' ', last_name)) as name`))
        .orderBy('first_name'),
    ]);
    res.status(200).json({
      status: 'success',
      data: { categories: cats.map((c) => c.category), owners, currentUserId: req.user?.userId ?? null, scopedDepartmentId: await scopedDepartment(req.user!.userId) },
      message: 'Form options retrieved successfully',
    });
  } catch (err) {
    sendRouteError(res, err);
  }
});

const score = Joi.number().integer().min(1).max(5).required();
const createRiskSchema = Joi.object({
  title: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().max(5000).allow('').default(''),
  category: Joi.string().trim().min(1).max(100).required(),
  departmentId: Joi.string().uuid().required(),
  ownerId: Joi.string().uuid().allow(null, '').default(null),
  impact: score,
  likelihood: score,
  riskResponse: Joi.string().valid('mitigate', 'accept', 'transfer', 'avoid').default('mitigate'),
  nextReviewDate: Joi.date().iso().min('now').allow(null, '').default(null),
  divisionIds: Joi.array().items(Joi.string().uuid()).unique().default([]),
  action: Joi.object({
    title: Joi.string().trim().min(1).max(255).required(),
    ownerId: Joi.string().uuid().allow(null, '').default(null),
    dueDate: Joi.date().iso().allow(null, '').default(null),
    status: Joi.string().valid('not_started', 'in_progress', 'completed').default('not_started'),
  }).allow(null).default(null),
});

// POST /risks — creates a risk (code like IT-07), its affected divisions and an optional first mitigation action.
router.post('/', async (req, res) => {
  const { error, value } = createRiskSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    res.status(400).json({ status: 'error', data: null, message: error.message });
    return;
  }
  const v = value;
  try {
    // A Risk Champion can only log risks in their own department; moving one elsewhere is a transfer.
    const own = await scopedDepartment(req.user!.userId);
    if (own && v.departmentId !== own) {
      res.status(403).json({ status: 'error', data: null, message: 'You can only log risks in your own department.' });
      return;
    }
    const risk = await db.transaction(async (trx) => {
      const dept = await trx('departments').where({ id: v.departmentId }).first('code');
      if (!dept) throw Object.assign(new Error('Unknown department'), { status: 400 });
      const ids = [v.ownerId, v.action?.ownerId].filter(Boolean);
      if (ids.length) {
        const found = await trx('users').whereIn('id', ids).count<{ count: string }[]>('id as count');
        if (Number(found[0]?.count) !== new Set(ids).size) throw Object.assign(new Error('Unknown owner'), { status: 400 });
      }
      // shortcut: next code = highest number in the department + 1; two simultaneous creates can collide on the unique
      // code and one gets a 500. Add a retry or a per-department counter if that ever happens.
      const last = await trx('risks')
        .where('code', 'like', `${dept.code}-%`)
        .first<{ max: number | null }>(trx.raw(`max(substring(code from '[0-9]+$')::int) as max`));
      const next = (Number(last?.max) || 0) + 1;
      const [row] = await trx('risks')
        .insert({
          code: `${dept.code}-${String(next).padStart(2, '0')}`,
          title: v.title,
          description: v.description || null,
          category: v.category,
          department_id: v.departmentId,
          owner_id: v.ownerId || null,
          impact: v.impact,
          likelihood: v.likelihood,
          risk_response: v.riskResponse,
          // An accepted risk needs no further action, so it starts inactive.
          status: v.riskResponse === 'accept' ? 'closed' : 'open',
          next_review_date: v.nextReviewDate || null,
          created_by: req.user!.userId,
        })
        .returning(['id', 'code']);
      if (v.description) await trx('risk_description_versions').insert({ risk_id: row.id, body: v.description, edited_by: req.user!.userId });
      await trx.raw(`insert into risk_rating_snapshots (risk_id, month, rating) values (?, date_trunc('month', now())::date, ?)`, [row.id, v.impact * v.likelihood]);
      const divisions = v.divisionIds.filter((d: string) => d !== v.departmentId);
      if (divisions.length) await trx('risk_divisions').insert(divisions.map((d: string) => ({ risk_id: row.id, department_id: d })));
      if (v.action) {
        await trx('mitigation_actions').insert({
          risk_id: row.id,
          title: v.action.title,
          owner_id: v.action.ownerId || null,
          due_date: v.action.dueDate || null,
          status: v.action.status,
        });
      }
      return row;
    });
    res.status(201).json({ status: 'success', data: risk, message: 'Risk created successfully' });
  } catch (err) {
    if ((err as { status?: number }).status === 400) {
      res.status(400).json({ status: 'error', data: null, message: (err as Error).message });
      return;
    }
    sendRouteError(res, err);
  }
});

// GET /risks/:id/actions — mitigation actions for the register's expanded row.
router.get('/:id/actions', async (req, res) => {
  const { error } = Joi.string().uuid().validate(req.params.id);
  if (error) {
    res.status(400).json({ status: 'error', data: null, message: 'Invalid risk id' });
    return;
  }
  try {
    const rows = await db('mitigation_actions as a')
      .leftJoin('users as u', 'u.id', 'a.owner_id')
      .where('a.risk_id', req.params.id)
      .orderBy([{ column: 'a.due_date', nulls: 'last' }, { column: 'a.created_at' }])
      .select(
        'a.id',
        'a.title',
        'a.description',
        'a.status',
        'a.due_date as dueDate',
        'a.updated_at as updatedAt',
        'a.owner_id as ownerId',
        db.raw(`nullif(trim(concat(u.first_name, ' ', u.last_name)), '') as owner`),
      );
    res.status(200).json({ status: 'success', data: rows, message: 'Mitigation actions retrieved successfully' });
  } catch (err) {
    sendRouteError(res, err);
  }
});

// GET /risks?departmentId=<uuid>  — active (non-archived) risks, highest rating first.
// shortcut: no role scoping yet (a Risk Champion should only see their own department, FR-SCORE-003);
// add once users are linked to departments.
router.get('/', async (req, res) => {
  const { month } = req.query as { month?: string };
  // A Risk Champion's heat map is their own department's, whatever the request asks for.
  const own = await scopedDepartment(req.user!.userId);
  const departmentId = own ?? (req.query.departmentId as string | undefined);
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    res.status(400).json({ status: 'error', data: null, message: 'month must be YYYY-MM' });
    return;
  }
  // With a month, each risk carries the rating its snapshot recorded then, and risks that did not exist yet drop out.
  const rating = ratingSql(month);
  try {
    const rows = await db('risks as r')
      .join('departments as d', 'd.id', 'r.department_id')
      .leftJoin('users as u', 'u.id', 'r.owner_id')
      .whereNull('r.archived_at')
      .modify((q) => {
        if (departmentId) q.where('r.department_id', departmentId);
        if (month) q.whereRaw(`${rating} is not null`);
      })
      .orderBy(orderFor('rating_desc', rating))
      .select(registerColumns(rating));
    res.status(200).json({ status: 'success', data: rows, message: 'Risks retrieved successfully' });
  } catch (err) {
    sendRouteError(res, err);
  }
});

export default router;
