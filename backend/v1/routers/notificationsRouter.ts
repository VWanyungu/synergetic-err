import express from 'express';
import db from '../database/dbSetup.js';
import { sendRouteError } from '../utils/errors.js';

const router = express.Router();

const fullName = (u?: { first_name: string; last_name: string } | null) => (u ? `${u.first_name} ${u.last_name}`.trim() : null);

// GET /notifications[?filter=unread] — newest first, with the live status of any archive request the notification is about.
router.get('/', async (req, res) => {
  try {
    const me = req.user!.userId;
    const rows = await db('notifications as n')
      .leftJoin('archive_requests as a', 'a.id', 'n.request_id')
      .leftJoin('users as d', 'd.id', 'a.decided_by')
      .leftJoin('risks as r', 'r.id', 'n.risk_id')
      .where('n.recipient_id', me)
      .modify((q) => req.query.filter === 'unread' && q.whereNull('n.read_at'))
      .orderBy('n.created_at', 'desc')
      .limit(100)
      .select('n.id', 'n.type', 'n.title', 'n.body', 'n.risk_id as riskId', 'n.request_id as requestId', 'n.read_at as readAt', 'n.created_at as createdAt', 'r.code as riskCode', 'a.status as requestStatus', 'a.decided_at as decidedAt', 'd.first_name', 'd.last_name');
    const unread = await db('notifications').where({ recipient_id: me }).whereNull('read_at').count<{ count: string }[]>('id as count').first();
    res.status(200).json({
      status: 'success',
      data: {
        unreadCount: Number(unread?.count ?? 0),
        notifications: rows.map(({ first_name, last_name, ...n }: { first_name: string | null; last_name: string | null } & Record<string, unknown>) => ({ ...n, decidedBy: fullName(first_name ? { first_name, last_name: last_name ?? '' } : null) })),
      },
      message: 'Notifications retrieved successfully',
    });
  } catch (err) {
    sendRouteError(res, err);
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    const n = await db('notifications').where({ id: req.params.id, recipient_id: req.user!.userId }).update({ read_at: db.fn.now() });
    res.status(n ? 200 : 404).json({ status: n ? 'success' : 'error', data: null, message: n ? 'Marked as read' : 'Notification not found' });
  } catch (err) {
    sendRouteError(res, err);
  }
});

router.post('/read-all', async (req, res) => {
  try {
    await db('notifications').where({ recipient_id: req.user!.userId }).whereNull('read_at').update({ read_at: db.fn.now() });
    res.status(200).json({ status: 'success', data: null, message: 'All notifications marked as read' });
  } catch (err) {
    sendRouteError(res, err);
  }
});

// POST /notifications/requests/:id/approve|reject — Risk Officer or Admin decides an archive request.
const decide = (outcome: 'approve' | 'reject') =>
  router.post(`/requests/:id/${outcome}`, async (req, res) => {
    try {
      const me = req.user!.userId;
      const roles = await db('roles').where({ user_id: me }).whereNull('revoked_at').pluck('role');
      if (!roles.includes('Risk Officer') && !roles.includes('Admin')) {
        res.status(403).json({ status: 'error', data: null, message: 'Only a Risk Officer can decide archive requests.' });
        return;
      }
      const result = await db.transaction(async (t) => {
        const request = await t('archive_requests as a').join('risks as r', 'r.id', 'a.risk_id').where('a.id', req.params.id).first('a.id', 'a.status', 'a.requested_by', 'a.risk_id', 'r.code', 'r.title');
        if (!request) return { status: 404, message: 'Request not found' };
        if (request.status !== 'pending') return { status: 409, message: `This request was already ${request.status}.` };
        const approved = outcome === 'approve';
        await t('archive_requests').where({ id: request.id }).update({ status: approved ? 'approved' : 'rejected', decided_by: me, decided_at: t.fn.now() });
        if (approved) {
          await t('risks').where({ id: request.risk_id }).update({ archived_at: t.fn.now(), updated_at: t.fn.now() });
          await t('risk_activity').insert({ risk_id: request.risk_id, actor_id: me, type: 'archived', data: JSON.stringify({ requestedBy: request.requested_by }) });
        }
        // The decision settles it for every officer who was asked.
        await t('notifications').where({ request_id: request.id }).whereNull('read_at').update({ read_at: t.fn.now() });
        await t('notifications').insert({
          recipient_id: request.requested_by,
          type: approved ? 'archive_approved' : 'archive_rejected',
          title: approved ? 'Archive request approved' : 'Archive request rejected',
          body: `${request.code} ${request.title} was ${approved ? 'archived' : 'kept in the register'} by a Risk Officer.`,
          risk_id: request.risk_id,
          request_id: request.id,
        });
        return { status: 200, message: approved ? 'Risk archived' : 'Request rejected' };
      });
      res.status(result.status).json({ status: result.status === 200 ? 'success' : 'error', data: null, message: result.message });
    } catch (err) {
      sendRouteError(res, err);
    }
  });
decide('approve');
decide('reject');

export default router;
