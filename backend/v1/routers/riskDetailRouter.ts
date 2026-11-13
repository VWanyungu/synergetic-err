import express from 'express';
import Joi from 'joi';
import type { Knex } from 'knex';
import db from '../database/dbSetup.js';
import { sendRouteError } from '../utils/errors.js';
import { uploadToCloudinary, isStorageConfigured } from '../utils/cloudinary.js';

const router = express.Router();

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
const fail = (res: express.Response, err: unknown) =>
  err instanceof HttpError ? res.status(err.status).json({ status: 'error', data: null, message: err.message }) : sendRouteError(res, err);
const ok = (res: express.Response, data: unknown, message: string, status = 200) => res.status(status).json({ status: 'success', data, message });

const uuid = Joi.string().uuid().required();
function check<T>(schema: Joi.Schema, value: unknown): T {
  const { error, value: v } = schema.validate(value, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, error.message);
  return v as T;
}

const roleLabel = (roles: string[]) =>
  roles.includes('Risk Officer') ? 'Risk Officer' : roles.includes('Risk Champion') ? 'Risk Champion' : roles.includes('Admin') ? 'Admin' : null;

type Viewer = { id: string; roles: string[]; departmentId: string | null };
async function viewer(req: express.Request): Promise<Viewer> {
  const id = req.user!.userId;
  const [u, roles] = await Promise.all([
    db('users').where({ id }).first('department_id'),
    db('roles').where({ user_id: id }).whereNull('revoked_at').pluck('role'),
  ]);
  return { id, roles, departmentId: u?.department_id ?? null };
}

// Edit, transfer, close and archive share one rule (FR-SCORE-003): Admin and Risk Officer anywhere,
// a Risk Champion only in their own department. A transferred risk therefore turns read-only for its old department.
const canEdit = (v: Viewer, departmentId: string) =>
  v.roles.includes('Admin') || v.roles.includes('Risk Officer') || (v.roles.includes('Risk Champion') && v.departmentId === departmentId);

async function loadRisk(id: string) {
  const risk = await db('risks').where({ id }).first();
  if (!risk) throw new HttpError(404, 'Risk not found');
  return risk as { id: string; code: string; title: string; description: string | null; category: string; department_id: string; owner_id: string | null; likelihood: number; impact: number; rating: number; status: string; risk_response: string; next_review_date: string | null; archived_at: Date | null };
}
async function editable(req: express.Request) {
  const id = check<string>(uuid, req.params.id);
  const [risk, v] = await Promise.all([loadRisk(id), viewer(req)]);
  if (!canEdit(v, risk.department_id)) throw new HttpError(403, 'Only the risk’s department can edit it.');
  return { risk, v };
}

const log = (t: Knex | Knex.Transaction, riskId: string, actorId: string, type: string, data: object = {}, body: string | null = null) =>
  t('risk_activity').insert({ risk_id: riskId, actor_id: actorId, type, data: JSON.stringify(data), body });

const fullName = (u?: { first_name: string; last_name: string } | null) => (u ? `${u.first_name} ${u.last_name}`.trim() : null);
const nameOf = async (t: Knex | Knex.Transaction, id: string | null) => (id ? fullName(await t('users').where({ id }).first('first_name', 'last_name')) : null);
const monthOf = (d = new Date()) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;

// ---------------------------------------------------------------- read

router.get('/:id', async (req, res) => {
  try {
    const id = check<string>(uuid, req.params.id);
    const risk = await loadRisk(id);
    const v = await viewer(req);
    const pendingArchive = await db('archive_requests as a').join('users as u', 'u.id', 'a.requested_by').where({ 'a.risk_id': id, 'a.status': 'pending' }).first('a.id', 'a.created_at', 'u.first_name', 'u.last_name');
    const [dept, owner, divisions, counts, actors, versions, transfers] = await Promise.all([
      db('departments').where({ id: risk.department_id }).first('id', 'name'),
      risk.owner_id ? db('users').where({ id: risk.owner_id }).first('id', 'first_name', 'last_name', 'department_id') : null,
      db('risk_divisions as rd').join('departments as d', 'd.id', 'rd.department_id').where('rd.risk_id', id).select('d.id', 'd.name', 'd.code').orderBy('d.name'),
      db.raw(
        `select (select count(*) from risk_activity where risk_id = ? and type = 'comment')::int as comments,
                (select count(*) from mitigation_actions where risk_id = ?)::int as plans`,
        [id, id],
      ),
      db('users as u')
        .whereIn('u.id', db('risk_activity').where({ risk_id: id }).whereNotNull('actor_id').select('actor_id').union([db('risks').where({ id }).whereNotNull('created_by').select('created_by'), db('risks').where({ id }).whereNotNull('owner_id').select('owner_id')]))
        .select('u.id', 'u.first_name', 'u.last_name'),
      db('risk_description_versions as v').join('users as u', 'u.id', 'v.edited_by').where('v.risk_id', id).orderBy('v.created_at', 'desc').select('u.first_name', 'u.last_name', 'v.created_at'),
      db('risk_activity as a').leftJoin('users as u', 'u.id', 'a.actor_id').where({ 'a.risk_id': id, 'a.type': 'transferred' }).orderBy('a.created_at', 'desc').select('a.data', 'a.created_at', 'u.first_name', 'u.last_name'),
    ]);
    const ownerRoles = owner ? await db('roles').where({ user_id: owner.id }).whereNull('revoked_at').pluck('role') : [];
    const ownerDept = owner?.department_id ? (await db('departments').where({ id: owner.department_id }).first('name'))?.name : null;
    const createdRow = await db('risks').where({ id }).first('created_at', 'last_reviewed_at', 'created_by');
    const createdBy = createdRow.created_by ? fullName(await db('users').where({ id: createdRow.created_by }).first('first_name', 'last_name')) : null;
    const loggedByRole = createdRow.created_by ? roleLabel(await db('roles').where({ user_id: createdRow.created_by }).whereNull('revoked_at').pluck('role')) : null;
    ok(
      res,
      {
        id: risk.id,
        code: risk.code,
        title: risk.title,
        description: risk.description ?? '',
        category: risk.category,
        status: risk.status,
        archived: risk.archived_at !== null,
        riskResponse: risk.risk_response,
        likelihood: risk.likelihood,
        impact: risk.impact,
        rating: risk.rating,
        department: dept,
        owner: owner ? { id: owner.id, name: fullName(owner), role: roleLabel(ownerRoles), department: ownerDept } : null,
        divisions,
        loggedBy: createdBy,
        loggedByRole,
        loggedAt: createdRow.created_at,
        lastReviewedAt: createdRow.last_reviewed_at,
        nextReviewDate: risk.next_review_date,
        commentCount: counts.rows[0].comments,
        planCount: counts.rows[0].plans,
        participants: actors.map((a: { id: string; first_name: string; last_name: string }) => ({ id: a.id, name: fullName(a) })),
        descriptionEdits: Math.max(versions.length - 1, 0),
        lastEditor: versions.length > 1 ? fullName(versions[0]) : null,
        transfer: transfers[0] ? { at: transfers[0].created_at, ...transfers[0].data } : null,
        // Every transfer, newest first, for the Transferred card's history.
        transfers: transfers.map((t) => ({ at: t.created_at, from: t.data.from ?? null, to: t.data.to ?? null, by: fullName(t.first_name ? t : null) })),
        can: { edit: canEdit(v, risk.department_id), archiveDirect: v.roles.includes('Admin') || v.roles.includes('Risk Officer') },
        archiveRequest: pendingArchive ? { id: pendingArchive.id, requestedAt: pendingArchive.created_at, requestedBy: fullName(pendingArchive) } : null,
      },
      'Risk retrieved successfully',
    );
  } catch (err) {
    fail(res, err);
  }
});

router.get('/:id/activity', async (req, res) => {
  try {
    const id = check<string>(uuid, req.params.id);
    const rows = await db('risk_activity as a')
      .leftJoin('users as u', 'u.id', 'a.actor_id')
      .where('a.risk_id', id)
      .orderBy('a.created_at')
      .select('a.id', 'a.type', 'a.body', 'a.data', 'a.created_at', 'a.edited_at', 'a.actor_id', 'u.first_name', 'u.last_name');
    const ids = rows.map((r) => r.actor_id).filter(Boolean);
    const [grants, files, edits] = await Promise.all([
      db('roles').whereIn('user_id', ids).whereNull('revoked_at').select('user_id', 'role'),
      db('risk_attachments').where({ risk_id: id }).whereNotNull('activity_id').select('id', 'activity_id', 'name', 'mime_type', 'bytes', 'url'),
      db('risk_comment_versions').whereIn('activity_id', rows.map((r) => r.id)).select('activity_id'),
    ]);
    const rolesOf = (uid: string) => roleLabel(grants.filter((g) => g.user_id === uid).map((g) => g.role));
    ok(
      res,
      rows.map((r) => ({
        id: r.id,
        type: r.type,
        body: r.body,
        data: r.data,
        createdAt: r.created_at,
        editedAt: r.edited_at,
        actor: r.actor_id ? { id: r.actor_id, name: fullName(r), role: rolesOf(r.actor_id) } : null,
        attachments: files.filter((f) => f.activity_id === r.id).map((f) => ({ id: f.id, name: f.name, mimeType: f.mime_type, bytes: f.bytes, url: f.url })),
        edited: edits.some((e) => e.activity_id === r.id),
      })),
      'Activity retrieved successfully',
    );
  } catch (err) {
    fail(res, err);
  }
});

router.get('/:id/description-history', async (req, res) => {
  try {
    const id = check<string>(uuid, req.params.id);
    const rows = await db('risk_description_versions as v')
      .leftJoin('users as u', 'u.id', 'v.edited_by')
      .where('v.risk_id', id)
      .orderBy('v.created_at')
      .select('v.id', 'v.body', 'v.created_at', 'u.first_name', 'u.last_name');
    ok(res, rows.map((r) => ({ id: r.id, body: r.body, createdAt: r.created_at, editor: fullName(r) })), 'History retrieved successfully');
  } catch (err) {
    fail(res, err);
  }
});

router.get('/:id/comments/:cid/history', async (req, res) => {
  try {
    const id = check<string>(uuid, req.params.id);
    const cid = check<string>(uuid, req.params.cid);
    const c = await db('risk_activity as a').leftJoin('users as u', 'u.id', 'a.actor_id').where({ 'a.id': cid, 'a.risk_id': id, 'a.type': 'comment' }).first('a.body', 'a.created_at', 'a.edited_at', 'u.first_name', 'u.last_name');
    if (!c) throw new HttpError(404, 'Comment not found');
    const old = await db('risk_comment_versions as v').leftJoin('users as u', 'u.id', 'v.edited_by').where('v.activity_id', cid).orderBy('v.created_at').select('v.id', 'v.body', 'v.created_at', 'u.first_name', 'u.last_name');
    // Each stored version holds the text as it stood; its created_at is when that text was replaced, so shift to "when written".
    const written = [c.created_at, ...old.map((o) => o.created_at)];
    const versions = old.map((o, i) => ({ id: o.id, body: o.body, createdAt: written[i], editor: fullName(o) }));
    if (old.length) versions.push({ id: cid, body: c.body, createdAt: c.edited_at, editor: fullName(c) });
    ok(res, versions, 'History retrieved successfully');
  } catch (err) {
    fail(res, err);
  }
});

// ---------------------------------------------------------------- edit

const patchSchema = Joi.object({
  title: Joi.string().trim().min(1).max(255),
  description: Joi.string().trim().min(1).max(5000),
  category: Joi.string().trim().min(1).max(100),
  riskResponse: Joi.string().valid('mitigate', 'accept', 'transfer', 'avoid'),
  impact: Joi.number().integer().min(1).max(5),
  likelihood: Joi.number().integer().min(1).max(5),
  ownerId: Joi.string().uuid().allow(null),
  nextReviewDate: Joi.date().iso().allow(null),
  divisionIds: Joi.array().items(Joi.string().uuid()).unique(),
}).min(1);

router.patch('/:id', async (req, res) => {
  try {
    const { risk, v } = await editable(req);
    const b = check<Record<string, unknown> & { divisionIds?: string[]; nextReviewDate?: Date | null; ownerId?: string | null }>(patchSchema, req.body);
    await db.transaction(async (t) => {
      const set: Record<string, unknown> = { updated_at: t.fn.now() };
      const same = (k: keyof typeof risk, val: unknown) => risk[k] === val;
      if (b.title !== undefined && !same('title', b.title)) {
        set.title = b.title;
        await log(t, risk.id, v.id, 'title_changed', { from: risk.title, to: b.title });
      }
      if (b.category !== undefined && !same('category', b.category)) {
        set.category = b.category;
        await log(t, risk.id, v.id, 'category_changed', { from: risk.category, to: b.category });
      }
      if (b.riskResponse !== undefined && !same('risk_response', b.riskResponse)) {
        set.risk_response = b.riskResponse;
        await log(t, risk.id, v.id, 'response_changed', { from: risk.risk_response, to: b.riskResponse });
        // Accepting a risk means no further action: it stands down (goes inactive) with it. Reinstating is a separate, deliberate step.
        if (b.riskResponse === 'accept' && risk.status !== 'closed') {
          set.status = 'closed';
          await log(t, risk.id, v.id, 'closed', { reason: 'accept' });
        }
      }
      if (b.description !== undefined && !same('description', b.description)) {
        set.description = b.description;
        await t('risk_description_versions').insert({ risk_id: risk.id, body: b.description, edited_by: v.id });
        await log(t, risk.id, v.id, 'description_edited');
      }
      if (b.ownerId !== undefined && b.ownerId !== risk.owner_id) {
        if (b.ownerId && !(await t('users').where({ id: b.ownerId }).first('id'))) throw new HttpError(400, 'Unknown owner');
        set.owner_id = b.ownerId;
        await log(t, risk.id, v.id, 'owner_changed', { from: await nameOf(t, risk.owner_id), to: await nameOf(t, b.ownerId) });
      }
      if (b.nextReviewDate !== undefined) {
        const to = b.nextReviewDate ? new Date(b.nextReviewDate).toISOString().slice(0, 10) : null;
        if (to !== (risk.next_review_date ? new Date(risk.next_review_date).toISOString().slice(0, 10) : null)) {
          set.next_review_date = to;
          await log(t, risk.id, v.id, 'next_review_changed', { to });
        }
      }
      const scores: ['likelihood' | 'impact', number | undefined][] = [['likelihood', b.likelihood as number | undefined], ['impact', b.impact as number | undefined]];
      let rating = risk.rating;
      const changed = scores.filter(([k, to]) => to !== undefined && to !== risk[k]);
      if (changed.length) {
        for (const [k, to] of changed) set[k] = to;
        rating = ((set.likelihood as number) ?? risk.likelihood) * ((set.impact as number) ?? risk.impact);
        for (const [k, to] of changed) await log(t, risk.id, v.id, 'rating_changed', { field: k, from: risk[k], to, rating });
        await t.raw(
          `insert into risk_rating_snapshots (risk_id, month, rating) values (?, ?, ?) on conflict (risk_id, month) do update set rating = excluded.rating`,
          [risk.id, monthOf(), rating],
        );
      }
      if (b.divisionIds) {
        const next = b.divisionIds.filter((d) => d !== risk.department_id);
        const current: string[] = await t('risk_divisions').where({ risk_id: risk.id }).pluck('department_id');
        const names = Object.fromEntries((await t('departments').select('id', 'name')).map((d) => [d.id, d.name]));
        if (next.some((d) => !names[d])) throw new HttpError(400, 'Unknown department');
        for (const d of next.filter((d) => !current.includes(d))) {
          await t('risk_divisions').insert({ risk_id: risk.id, department_id: d });
          await log(t, risk.id, v.id, 'division_added', { name: names[d] });
        }
        for (const d of current.filter((d) => !next.includes(d))) {
          await t('risk_divisions').where({ risk_id: risk.id, department_id: d }).del();
          await log(t, risk.id, v.id, 'division_removed', { name: names[d] });
        }
      }
      await t('risks').where({ id: risk.id }).update(set);
    });
    ok(res, null, 'Risk updated successfully');
  } catch (err) {
    fail(res, err);
  }
});

router.post('/:id/review', async (req, res) => {
  try {
    const { risk, v } = await editable(req);
    await db.transaction(async (t) => {
      await t('risks').where({ id: risk.id }).update({ last_reviewed_at: t.fn.now(), updated_at: t.fn.now() });
      await log(t, risk.id, v.id, 'reviewed');
    });
    ok(res, null, 'Marked as reviewed');
  } catch (err) {
    fail(res, err);
  }
});

const lifecycle = (path: string, type: string, apply: (r: Record<string, unknown>) => Record<string, unknown>, done: string) =>
  router.post(`/:id/${path}`, async (req, res) => {
    try {
      const { risk, v } = await editable(req);
      await db.transaction(async (t) => {
        await t('risks').where({ id: risk.id }).update({ ...apply({}), updated_at: t.fn.now() });
        await log(t, risk.id, v.id, type);
      });
      ok(res, null, done);
    } catch (err) {
      fail(res, err);
    }
  });
// Closing a risk means it is accepted as it stands: inactive, with the response set to Accept. Opening it leaves the response alone.
router.post('/:id/close', async (req, res) => {
  try {
    const { risk, v } = await editable(req);
    await db.transaction(async (t) => {
      await t('risks').where({ id: risk.id }).update({ status: 'closed', risk_response: 'accept', updated_at: t.fn.now() });
      if (risk.risk_response !== 'accept') await log(t, risk.id, v.id, 'response_changed', { from: risk.risk_response, to: 'accept' });
      await log(t, risk.id, v.id, 'closed');
    });
    ok(res, null, 'Risk closed');
  } catch (err) {
    fail(res, err);
  }
});
lifecycle('reopen', 'reopened', () => ({ status: 'open' }), 'Risk opened');
// Archiving: an Admin or Risk Officer archives outright; a Risk Champion sends a request that Risk Officers decide (see /notifications).
router.post('/:id/archive', async (req, res) => {
  try {
    const { risk, v } = await editable(req);
    if (v.roles.includes('Admin') || v.roles.includes('Risk Officer')) {
      await db.transaction(async (t) => {
        await t('risks').where({ id: risk.id }).update({ archived_at: t.fn.now(), updated_at: t.fn.now() });
        await log(t, risk.id, v.id, 'archived');
      });
      ok(res, { requested: false }, 'Risk archived');
      return;
    }
    await db.transaction(async (t) => {
      if (await t('archive_requests').where({ risk_id: risk.id, status: 'pending' }).first('id')) throw new HttpError(409, 'An archive request for this risk is already waiting for a Risk Officer.');
      const [request] = await t('archive_requests').insert({ risk_id: risk.id, requested_by: v.id }).returning('id');
      const [who, deciders] = await Promise.all([
        nameOf(t, v.id),
        t('roles').whereIn('role', ['Risk Officer', 'Admin']).whereNull('revoked_at').distinct('user_id').pluck('user_id'),
      ]);
      if (deciders.length)
        await t('notifications').insert(
          deciders.map((uid: string) => ({
            recipient_id: uid,
            type: 'archive_request',
            title: 'Archive request',
            body: `${who} asks to archive ${risk.code} ${risk.title}.`,
            risk_id: risk.id,
            request_id: request.id,
          })),
        );
    });
    ok(res, { requested: true }, 'Archive requested', 202);
  } catch (err) {
    fail(res, err);
  }
});

lifecycle('unarchive', 'unarchived', () => ({ archived_at: null }), 'Risk unarchived');

router.post('/:id/transfer', async (req, res) => {
  try {
    const { risk, v } = await editable(req);
    const { departmentId } = check<{ departmentId: string }>(Joi.object({ departmentId: uuid }), req.body);
    if (departmentId === risk.department_id) throw new HttpError(400, 'The risk already belongs to that department.');
    await db.transaction(async (t) => {
      const [from, to] = await Promise.all([t('departments').where({ id: risk.department_id }).first('name'), t('departments').where({ id: departmentId }).first('name')]);
      if (!to) throw new HttpError(400, 'Unknown department');
      await t('risks').where({ id: risk.id }).update({ department_id: departmentId, updated_at: t.fn.now() });
      await t('risk_divisions').where({ risk_id: risk.id, department_id: departmentId }).del();
      await log(t, risk.id, v.id, 'transferred', { from: from?.name, to: to.name });
    });
    ok(res, null, 'Risk transferred');
  } catch (err) {
    fail(res, err);
  }
});

// ---------------------------------------------------------------- comments and files

router.post('/:id/comments', async (req, res) => {
  try {
    const id = check<string>(uuid, req.params.id);
    await loadRisk(id);
    const b = check<{ body: string; attachmentIds: string[] }>(
      Joi.object({ body: Joi.string().trim().min(1).max(10000).required(), attachmentIds: Joi.array().items(Joi.string().uuid()).max(10).default([]) }),
      req.body,
    );
    const row = await db.transaction(async (t) => {
      const [a] = await t('risk_activity').insert({ risk_id: id, actor_id: req.user!.userId, type: 'comment', body: b.body }).returning('id');
      if (b.attachmentIds.length)
        await t('risk_attachments').where({ risk_id: id, uploaded_by: req.user!.userId }).whereNull('activity_id').whereIn('id', b.attachmentIds).update({ activity_id: a.id });
      return a;
    });
    ok(res, { id: row.id }, 'Comment added', 201);
  } catch (err) {
    fail(res, err);
  }
});

router.patch('/:id/comments/:cid', async (req, res) => {
  try {
    const id = check<string>(uuid, req.params.id);
    const cid = check<string>(uuid, req.params.cid);
    const { body } = check<{ body: string }>(Joi.object({ body: Joi.string().trim().min(1).max(10000).required() }), req.body);
    const c = await db('risk_activity').where({ id: cid, risk_id: id, type: 'comment' }).first();
    if (!c) throw new HttpError(404, 'Comment not found');
    if (c.actor_id !== req.user!.userId) throw new HttpError(403, 'You can only edit your own comments.');
    if (c.body !== body)
      await db.transaction(async (t) => {
        await t('risk_comment_versions').insert({ activity_id: cid, body: c.body, edited_by: c.actor_id, created_at: c.edited_at ?? c.created_at });
        await t('risk_activity').where({ id: cid }).update({ body, edited_at: t.fn.now() });
      });
    ok(res, null, 'Comment updated');
  } catch (err) {
    fail(res, err);
  }
});

const MAX_FILE = 10 * 1024 * 1024;
// shortcut: files arrive as base64 JSON and are buffered in memory; switch to streamed multipart if the 10 MB cap rises.
router.post('/:id/attachments', async (req, res) => {
  try {
    const id = check<string>(uuid, req.params.id);
    await loadRisk(id);
    const b = check<{ name: string; mimeType: string; data: string }>(
      Joi.object({ name: Joi.string().trim().max(200).required(), mimeType: Joi.string().max(120).default('application/octet-stream'), data: Joi.string().required() }),
      req.body,
    );
    const buf = Buffer.from(b.data.replace(/^data:[^,]*,/, ''), 'base64');
    if (buf.length === 0 || buf.length > MAX_FILE) throw new HttpError(400, 'Files must be between 1 byte and 10 MB.');
    if (!isStorageConfigured())
      throw new HttpError(503, 'File uploads are not configured yet.');
    const up = await uploadToCloudinary(buf, b.name, b.mimeType).catch(() => {
      throw new HttpError(502, 'The file could not be uploaded. Try again.');
    });
    const [row] = await db('risk_attachments')
      .insert({ risk_id: id, uploaded_by: req.user!.userId, name: b.name, mime_type: b.mimeType, bytes: up.bytes, url: up.url, public_id: up.publicId })
      .returning(['id', 'name', 'mime_type', 'bytes', 'url']);
    ok(res, { id: row.id, name: row.name, mimeType: row.mime_type, bytes: row.bytes, url: row.url }, 'File uploaded', 201);
  } catch (err) {
    fail(res, err);
  }
});

// ---------------------------------------------------------------- mitigation plans

const planSchema = Joi.object({
  title: Joi.string().trim().min(1).max(255),
  description: Joi.string().trim().allow('').max(5000),
  ownerId: Joi.string().uuid().allow(null),
  dueDate: Joi.date().iso().allow(null),
  status: Joi.string().valid('not_started', 'in_progress', 'completed'),
});
const toRow = (b: Record<string, unknown>) => ({
  ...(b.title !== undefined && { title: b.title }),
  ...(b.description !== undefined && { description: b.description || null }),
  ...(b.ownerId !== undefined && { owner_id: b.ownerId }),
  ...(b.dueDate !== undefined && { due_date: b.dueDate ? new Date(b.dueDate as string).toISOString().slice(0, 10) : null }),
  ...(b.status !== undefined && { status: b.status }),
});

router.post('/:id/actions', async (req, res) => {
  try {
    const { risk, v } = await editable(req);
    const b = check<Record<string, unknown>>(planSchema.fork(['title'], (s) => s.required()), req.body);
    const row = await db.transaction(async (t) => {
      const [a] = await t('mitigation_actions').insert({ risk_id: risk.id, status: 'not_started', ...toRow(b) }).returning('id');
      await log(t, risk.id, v.id, 'mitigation_added', { plan: b.title });
      return a;
    });
    ok(res, { id: row.id }, 'Mitigation plan added', 201);
  } catch (err) {
    fail(res, err);
  }
});

router.patch('/:id/actions/:aid', async (req, res) => {
  try {
    const { risk, v } = await editable(req);
    const aid = check<string>(uuid, req.params.aid);
    const b = check<Record<string, unknown>>(planSchema.min(1), req.body);
    const plan = await db('mitigation_actions').where({ id: aid, risk_id: risk.id }).first();
    if (!plan) throw new HttpError(404, 'Mitigation plan not found');
    await db.transaction(async (t) => {
      await t('mitigation_actions').where({ id: aid }).update({ ...toRow(b), updated_at: t.fn.now() });
      if (b.status !== undefined && b.status !== plan.status) await log(t, risk.id, v.id, 'mitigation_status', { plan: b.title ?? plan.title, from: plan.status, to: b.status });
    });
    ok(res, null, 'Mitigation plan updated');
  } catch (err) {
    fail(res, err);
  }
});

// ---------------------------------------------------------------- analytics

router.get('/:id/analytics', async (req, res) => {
  try {
    const id = check<string>(uuid, req.params.id);
    const { range } = check<{ range: 'year' | 'all' }>(Joi.object({ range: Joi.string().valid('year', 'all').default('year') }), req.query);
    await loadRisk(id);
    const rows: { month: string; rating: number }[] = (await db('risk_rating_snapshots').where({ risk_id: id }).orderBy('month').select(db.raw(`to_char(month, 'YYYY-MM-DD') as month`), 'rating'));
    // Months with no change carry the previous rating forward, up to this month.
    const points: { month: string; rating: number }[] = [];
    if (rows.length) {
      const known = new Map(rows.map((r) => [r.month, r.rating]));
      const [y0, m0] = rows[0]!.month.split('-').map(Number) as [number, number];
      const now = new Date();
      let prev = rows[0]!.rating;
      for (let d = new Date(Date.UTC(y0, m0 - 1, 1)); d <= now; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
        const key = monthOf(d);
        prev = known.get(key) ?? prev;
        points.push({ month: key, rating: prev });
      }
    }
    // "year" is the current calendar year's months, January to now.
    const thisYear = String(new Date().getFullYear());
    const shown = range === 'year' ? points.filter((p) => p.month.startsWith(thisYear)) : points;
    // Average rating per calendar year (a year's months run up to today for the current one), for the "All time" chart.
    const byYear = new Map<number, number[]>();
    for (const p of points) byYear.set(Number(p.month.slice(0, 4)), [...(byYear.get(Number(p.month.slice(0, 4))) ?? []), p.rating]);
    const years = [...byYear].map(([year, r]) => ({ year, average: Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10 }));
    const span = (pick: (p: { rating: number }) => boolean) => {
      const hit = shown.filter(pick);
      if (!hit.length) return null;
      const from = hit[0]!.month, to = hit[hit.length - 1]!.month;
      // Elapsed months between the first and last matching month (Aug to Nov = 3), at least 1.
      const months = Math.max((Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7)), 1);
      return { count: hit.length, months, from, to };
    };
    const max = Math.max(...shown.map((p) => p.rating));
    const min = Math.min(...shown.map((p) => p.rating));
    ok(
      res,
      {
        points: shown,
        years,
        current: shown.at(-1)?.rating ?? null,
        first: shown[0] ?? null,
        highest: shown.length ? { value: max, ...span((p) => p.rating === max)! } : null,
        lowest: shown.length ? { value: min, ...span((p) => p.rating === min)! } : null,
        changes: shown.filter((p, i) => i > 0 && p.rating !== shown[i - 1]!.rating).length,
        atHigh: span((p) => p.rating >= 15),
      },
      'Analytics retrieved successfully',
    );
  } catch (err) {
    fail(res, err);
  }
});

export default router;
