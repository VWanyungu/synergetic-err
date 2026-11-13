import express from 'express';
import db from '../database/dbSetup.js';
import { sendRouteError } from '../utils/errors.js';

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const rows = await db('divisions').select('id', 'name', 'code', 'description').orderBy('name');
    res.status(200).json({ status: 'success', data: rows, message: 'Divisions retrieved successfully' });
  } catch (err) {
    sendRouteError(res, err);
  }
});

export default router;

