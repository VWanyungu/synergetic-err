import express from 'express';
import Joi from 'joi';
import db from '../database/dbSetup.js';
import { sendRouteError } from '../utils/errors.js';

const router = express.Router();

const querySchema = Joi.object({
  q: Joi.string().trim().min(2).max(100).required(),
  limit: Joi.number().integer().min(1).max(10).default(5),
});

// GET /search?q= — risks, department registers and mitigation plans. Every signed-in user can read every risk, so nothing is narrowed by role.
router.get('/', async (req, res) => {
  const { error, value } = querySchema.validate(req.query, { stripUnknown: true });
  if (error) {
    res.status(400).json({ status: 'error', data: null, message: error.message });
    return;
  }
  const { q, limit } = value as { q: string; limit: number };
  const like = `%${q.replace(/[%_\\]/g, '\\$&')}%`;

  try {
    const [risks, registers, plans] = await Promise.all([
      db('risks as r')
        .join('departments as d', 'd.id', 'r.department_id')
        .leftJoin('users as u', 'u.id', 'r.owner_id')
        .whereNull('r.archived_at')
        .where((w) =>
          w
            .whereILike('r.title', like)
            .orWhereILike('r.code', like)
            .orWhereILike('r.category', like)
            .orWhereRaw(`concat(u.first_name, ' ', u.last_name) ilike ?`, [like]),
        )
        .orderBy('r.rating', 'desc')
        .limit(limit)
        .select('r.id', 'r.title', db.raw(`concat(r.code, ' · ', d.name) as subtitle`)),
      Promise.all([
        db('departments').whereILike('name', like).orderBy('name').limit(limit).select('id', 'name as title', db.raw(`'Department register' as subtitle`)),
        db('divisions').whereILike('name', like).orderBy('name').limit(limit).select('id', 'name as title', db.raw(`'Division register' as subtitle`)),
      ]).then(([depts, divs]) => [...depts, ...divs].slice(0, limit)),
      db('mitigation_actions as a')
        .join('risks as r', 'r.id', 'a.risk_id')
        .whereNull('r.archived_at')
        .whereILike('a.title', like)
        .orderBy('a.title')
        .limit(limit)
        .select('r.id', 'a.title', db.raw(`concat('Plan on ', r.code) as subtitle`)),
    ]);
    res.status(200).json({ status: 'success', data: { risks, registers, plans }, message: 'Search results' });
  } catch (err) {
    sendRouteError(res, err);
  }
});

export default router;
