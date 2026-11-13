import express from 'express';
import Joi from 'joi';
import db from '../database/dbSetup.js';
import { sendRouteError } from '../utils/errors.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';

const router = express.Router();

// GET /me — the signed-in user's own profile and the roles they hold.
router.get('/', async (req, res) => {
  try {
    const id = req.user!.userId;
    const user = await db('users as u')
      .leftJoin('departments as d', 'd.id', 'u.department_id')
      .where('u.id', id)
      .first('u.first_name', 'u.last_name', 'u.email', 'u.created_at', 'u.avatar_url', 'u.banner_url', 'd.id as departmentId', 'd.name as department');
    if (!user) {
      res.status(404).json({ status: 'error', data: null, message: 'User not found' });
      return;
    }
    const roles = await db('roles as r')
      .leftJoin('users as g', 'g.id', 'r.granted_by')
      .where('r.user_id', id)
      .whereNull('r.revoked_at')
      .orderBy('r.granted_at')
      .select('r.role', 'r.granted_at as since', db.raw(`nullif(trim(concat(g.first_name, ' ', g.last_name)), '') as "grantedBy"`));
    res.status(200).json({
      status: 'success',
      data: { firstName: user.first_name, lastName: user.last_name, email: user.email, createdAt: user.created_at, avatarUrl: user.avatar_url, bannerUrl: user.banner_url, departmentId: user.departmentId, department: user.department, roles },
      message: 'Profile retrieved successfully',
    });
  } catch (err) {
    sendRouteError(res, err);
  }
});

const MAX_IMAGE = 5 * 1024 * 1024;
const COLUMN = { avatar: 'avatar_url', banner: 'banner_url' } as const;

// PUT /me/avatar and /me/banner — body { name, mimeType, data } where data is the file as base64 (a data URL is fine).
router.put('/:kind', async (req, res) => {
  const kind = req.params.kind as keyof typeof COLUMN;
  if (!(kind in COLUMN)) {
    res.status(404).json({ status: 'error', data: null, message: 'Not found' });
    return;
  }
  const { error, value } = Joi.object({
    name: Joi.string().trim().max(200).required(),
    mimeType: Joi.string().pattern(/^image\//).required(),
    data: Joi.string().required(),
  }).validate(req.body, { stripUnknown: true });
  if (error) {
    res.status(400).json({ status: 'error', data: null, message: 'Choose an image file.' });
    return;
  }
  const buf = Buffer.from((value.data as string).replace(/^data:[^,]*,/, ''), 'base64');
  if (buf.length === 0 || buf.length > MAX_IMAGE) {
    res.status(400).json({ status: 'error', data: null, message: 'Images must be between 1 byte and 5 MB.' });
    return;
  }
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    res.status(503).json({ status: 'error', data: null, message: 'File uploads are not configured yet.' });
    return;
  }
  try {
    const up = await uploadToCloudinary(buf, value.name, value.mimeType, 'profile');
    await db('users').where({ id: req.user!.userId }).update({ [COLUMN[kind]]: up.url });
    res.status(200).json({ status: 'success', data: { url: up.url }, message: 'Image updated' });
  } catch (err) {
    sendRouteError(res, err);
  }
});

export default router;
