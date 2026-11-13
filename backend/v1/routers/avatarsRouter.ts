import express from 'express';
import db from '../database/dbSetup.js';
import { sendRouteError } from '../utils/errors.js';

const router = express.Router();

// GET /avatars — profile pictures by full name, for the few users who have one. Lets any avatar in the app show the picture instead of initials.
// shortcut: keyed by name, so two users sharing a full name would share a picture; key by id if the data ever carries ids everywhere.
router.get('/', async (_req, res) => {
  try {
    const rows = await db('users').whereNotNull('avatar_url').select('avatar_url', db.raw(`trim(concat(first_name, ' ', last_name)) as name`));
    res.status(200).json({ status: 'success', data: Object.fromEntries(rows.map((r: { name: string; avatar_url: string }) => [r.name, r.avatar_url])), message: 'Avatars retrieved successfully' });
  } catch (err) {
    sendRouteError(res, err);
  }
});

export default router;
