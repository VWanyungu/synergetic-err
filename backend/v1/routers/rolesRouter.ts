import express from 'express';
import { Roles, AccessRoles } from '../database/utils/database.js';
import authorize from '../middlewares/authorize.js';
import { sendRouteError } from '../utils/errors.js';
import {
  createRoleSchema,
  revokeRoleParamsSchema,
  revokeRoleBodySchema,
  listRolesQuerySchema,
  type CreateRoleBody,
  type RevokeRoleBody,
  type ListRolesQuery,
} from '../utils/validation.js';

const router = express.Router();

const canManage = authorize(['Admin']);

router.post('/', canManage, async (req, res) => {
  const { error, value } = createRoleSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    res.status(400).json({ status: 'error', data: null, message: error.message });
    return;
  }
  const { userId, role } = value as CreateRoleBody;

  const accessRole = await AccessRoles.getByName(role);
  if (!accessRole || !accessRole.is_active) {
    res.status(400).json({ status: 'error', data: null, message: 'Unknown or inactive role' });
    return;
  }

  try {
    const attributeId = await Roles.grant(userId, role, req.user!.userId);
    res.status(201).json({ status: 'success', data: { attributeId }, message: 'Role granted' });
  } catch (err) {
    sendRouteError(res, err);
  }
});

router.get('/', canManage, async (req, res) => {
  const { error, value } = listRolesQuerySchema.validate(req.query, { abortEarly: false });
  if (error) {
    res.status(400).json({ status: 'error', data: null, message: error.message });
    return;
  }
  const { userId, page, limit } = value as ListRolesQuery;

  try {
    const result = await Roles.list({ userId, page, limit });
    res.status(200).json({ status: 'success', data: result, message: 'Roles retrieved' });
  } catch (err) {
    sendRouteError(res, err);
  }
});

router.delete('/:attributeId', canManage, async (req, res) => {
  const params = revokeRoleParamsSchema.validate(req.params);
  if (params.error) {
    res.status(400).json({ status: 'error', data: null, message: params.error.message });
    return;
  }
  const { value, error } = revokeRoleBodySchema.validate(req.body ?? {});
  if (error) {
    res.status(400).json({ status: 'error', data: null, message: error.message });
    return;
  }
  const { attributeId } = params.value as { attributeId: string };
  const { reason = null } = value as RevokeRoleBody;

  try {
    const existingRole = await Roles.getById(attributeId);
    if (!existingRole) {
      res.status(404).json({ status: 'error', data: null, message: 'Role not found' });
      return;
    }

    const revokedRole = await Roles.revoke(attributeId, req.user!.userId, reason);
    res.status(200).json({ status: 'success', data: { revokedRole }, message: 'Role revoked' });
  } catch (err) {
    sendRouteError(res, err);
  }
});

export default router;
