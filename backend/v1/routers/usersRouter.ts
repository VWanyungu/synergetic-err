import express from 'express';
import db from '../database/dbSetup.js';
import { Users, Tokens, AccessRoles } from '../database/utils/database.js';
import type { AdminCreateUserInput, UpdateUserInput, RoleName } from '../database/utils/database.js';
import { Cache } from '../database/utils/cache.js';
import authorize from '../middlewares/authorize.js';
import { SEED_PASSWORD_HASH } from '../seeds/01_users.js';
import { sendRouteError } from '../utils/errors.js';
import {
  userIdParamSchema,
  listUsersQuerySchema,
  adminCreateUserSchema,
  updateUserSchema,
  setUserStatusSchema,
} from '../utils/validation.js';

const router = express.Router();

// Admins and Risk Officers manage users. A Risk Officer may not create Admins or touch Admin accounts (no climbing the ladder).
const canRead = authorize(['Risk Officer']);
const canWrite = authorize(['Risk Officer']);

const actorIsAdmin = (req: express.Request) => !!req.user!.role.some((g) => g.role === 'Admin' && g.scope_type === 'global');
const isAdminUser = async (id: string) => !!(await db('roles').where({ user_id: id, role: 'Admin' }).whereNull('revoked_at').first('attribute_id'));

/** Returns a message when this actor may not act on this user, otherwise null. */
async function forbidden(req: express.Request, targetId: string): Promise<string | null> {
  if (!actorIsAdmin(req) && (await isAdminUser(targetId))) return 'Only an Admin can change an Admin account.';
  return null;
}

/** What a role needs in order to be usable, or null when it is fine. Department roles live in one department, a Division Lead in one division. */
function roleNeeds(role: string | null | undefined, departmentId: string | null | undefined, divisionId: string | null | undefined): string | null {
  if ((role === 'Risk Champion' || role === 'Department Lead') && !departmentId) return `A ${role} needs a department.`;
  if (role === 'Division Lead' && !divisionId) return 'A Division Lead needs a division.';
  return null;
}

/** Ends every session of a user: refresh tokens are deleted and the access token cut-off moves to now. */
async function revokeSessions(id: string): Promise<Date | null> {
  const invalidatedAt = await Users.invalidateSessions(id);
  if (!invalidatedAt) return null;
  await Tokens.deleteAllRefreshTokensForUser(id);
  await Cache.set(`session_invalidated_${id}`, invalidatedAt.getTime(), { ex: 900 });
  return invalidatedAt;
}

/** Global role must be a currently-active entry in the access_role catalog. */
async function isGrantableRole(role: string | null | undefined): Promise<boolean> {
  if (!role) return true;
  const accessRole = await AccessRoles.getByName(role);
  return !!accessRole && accessRole.is_active;
}

router.get('/', canRead, async (req, res) => {
  const type = (req.query.type as string | undefined) ?? (req.body as { type?: string })?.type;
  const inputEmail =
    (req.query.inputEmail as string | undefined) ?? (req.body as { inputEmail?: string })?.inputEmail;

  switch (type) {
    case 'multiple': {
      const { error, value } = listUsersQuerySchema.validate(req.query, { abortEarly: false, stripUnknown: true });
      if (error) {
        res.status(400).json({ status: 'error', data: null, message: error.message });
        return;
      }
      const { page, limit, search, globalRole, status } = value;
      try {
        const response = await Users.getAllUsers({ page, limit, search, globalRole, status });
        res.status(200).json({
          status: 'success',
          data: { response },
          message: 'Users retrieved successfully',
        });
      } catch (err) {
        sendRouteError(res, err);
      }
      return;
    }

    case 'single': {
      try {
        if (!inputEmail) {
          res.status(400).json({ status: 'error', data: null, message: 'inputEmail required' });
          return;
        }
        const user = await Users.getSingleUserByEmail(inputEmail);
        if (!user.email) {
          res.status(404).json({ status: 'error', data: null, message: 'User not found' });
          return;
        }
        res.status(200).json({
          status: 'success',
          data: { email: user.email },
          message: 'User retrieved successfully',
        });
      } catch (err) {
        sendRouteError(res, err);
      }
      return;
    }

    default:
      res.status(400).json({
        status: 'error',
        data: null,
        message: 'Specify type of fetch in request body',
      });
  }
});

router.get('/:id', canRead, async (req, res) => {
  const { error, value } = userIdParamSchema.validate(req.params);
  if (error) {
    res.status(400).json({ status: 'error', data: null, message: error.message });
    return;
  }
  try {
    const user = await Users.getUserById((value as { id: string }).id);
    if (!user) {
      res.status(404).json({ status: 'error', data: null, message: 'User not found' });
      return;
    }
    res.status(200).json({ status: 'success', data: { user }, message: 'User retrieved successfully' });
  } catch (err) {
    sendRouteError(res, err);
  }
});

// Admin-created user — no password field in the UI, so we set the seed default password.
// The user signs in with it and resets it via the existing forgot-password flow.
router.post('/', canWrite, async (req, res) => {
  const { error, value } = adminCreateUserSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    res.status(400).json({ status: 'error', data: null, message: error.message });
    return;
  }
  if (!(await isGrantableRole((value as AdminCreateUserInput).globalRole as RoleName | null))) {
    res.status(400).json({ status: 'error', data: null, message: 'Unknown or inactive role' });
    return;
  }
  const input = value as AdminCreateUserInput;
  const denied = !actorIsAdmin(req) && input.globalRole === 'Admin' ? 'Only an Admin can create an Admin.' : roleNeeds(input.globalRole, input.departmentId, input.divisionId);
  if (denied) {
    res.status(denied.startsWith('Only') ? 403 : 400).json({ status: 'error', data: null, message: denied });
    return;
  }
  try {
    if (await db('users').whereRaw('lower(email) = ?', [input.email.toLowerCase()]).first('id')) {
      res.status(409).json({ status: 'error', data: null, message: 'A user with this email already exists.' });
      return;
    }
    const user = await Users.createUserAdmin(input, SEED_PASSWORD_HASH, req.user!.userId);
    res.status(201).json({ status: 'success', data: { user }, message: 'User created' });
  } catch (err) {
    sendRouteError(res, err);
  }
});

router.put('/:id', canWrite, async (req, res) => {
  const params = userIdParamSchema.validate(req.params);
  if (params.error) {
    res.status(400).json({ status: 'error', data: null, message: params.error.message });
    return;
  }
  const body = updateUserSchema.validate(req.body ?? {}, { abortEarly: false, stripUnknown: true });
  if (body.error) {
    res.status(400).json({ status: 'error', data: null, message: body.error.message });
    return;
  }
  if (!(await isGrantableRole((body.value as UpdateUserInput).globalRole as RoleName | null))) {
    res.status(400).json({ status: 'error', data: null, message: 'Unknown or inactive role' });
    return;
  }
  try {
    const id = (params.value as { id: string }).id;
    const input = body.value as UpdateUserInput;
    const current = await Users.getUserById(id);
    if (!current) {
      res.status(404).json({ status: 'error', data: null, message: 'User not found' });
      return;
    }
    const denied = (await forbidden(req, id)) ?? (!actorIsAdmin(req) && input.globalRole === 'Admin' ? 'Only an Admin can make someone an Admin.' : null);
    if (denied) {
      res.status(403).json({ status: 'error', data: null, message: denied });
      return;
    }
    // A Risk Champion works inside one department, so they cannot be left without one.
    const role = input.globalRole !== undefined ? input.globalRole : current.global_role;
    const department = input.departmentId !== undefined ? input.departmentId : current.department_id;
    const division = input.divisionId !== undefined ? input.divisionId : current.division_id;
    const needs = roleNeeds(role, department, division);
    if (needs) {
      res.status(400).json({ status: 'error', data: null, message: needs });
      return;
    }
    const user = await Users.updateUser(id, input, req.user!.userId);
    // Roles travel inside the sign-in token, so a changed role or department only takes effect after signing in again.
    if ((input.globalRole !== undefined && input.globalRole !== current.global_role) || (input.departmentId !== undefined && input.departmentId !== current.department_id) || (input.divisionId !== undefined && input.divisionId !== current.division_id)) await revokeSessions(id);
    res.status(200).json({ status: 'success', data: { user }, message: 'User updated' });
  } catch (err) {
    sendRouteError(res, err);
  }
});

// Deactivation is a soft status flag, not a delete — records stay, access is revoked.
router.patch('/:id/status', canWrite, async (req, res) => {
  const params = userIdParamSchema.validate(req.params);
  if (params.error) {
    res.status(400).json({ status: 'error', data: null, message: params.error.message });
    return;
  }
  const body = setUserStatusSchema.validate(req.body ?? {});
  if (body.error) {
    res.status(400).json({ status: 'error', data: null, message: body.error.message });
    return;
  }
  try {
    const id = (params.value as { id: string }).id;
    const denied = id === req.user!.userId && body.value.status === 'deactivated' ? 'You cannot deactivate your own account.' : await forbidden(req, id);
    if (denied) {
      res.status(403).json({ status: 'error', data: null, message: denied });
      return;
    }
    const user = await Users.setStatus(id, body.value.status);
    if (user && body.value.status === 'deactivated') await revokeSessions(id);
    if (!user) {
      res.status(404).json({ status: 'error', data: null, message: 'User not found' });
      return;
    }
    res.status(200).json({ status: 'success', data: { user }, message: 'User status updated' });
  } catch (err) {
    sendRouteError(res, err);
  }
});

// Forces the user to log in again everywhere: their refresh token is revoked outright,
// and their current access token (wherever it's held) stops being honoured as soon as
// it's next presented, via tokens_invalidated_at (see isSessionInvalidated).
router.post('/:id/invalidate-sessions', canWrite, async (req, res) => {
  const params = userIdParamSchema.validate(req.params);
  if (params.error) {
    res.status(400).json({ status: 'error', data: null, message: params.error.message });
    return;
  }
  const { id } = params.value as { id: string };
  try {
    const denied = await forbidden(req, id);
    if (denied) {
      res.status(403).json({ status: 'error', data: null, message: denied });
      return;
    }
    const invalidatedAt = await revokeSessions(id);
    if (!invalidatedAt) {
      res.status(404).json({ status: 'error', data: null, message: 'User not found' });
      return;
    }
    res.status(200).json({ status: 'success', data: { invalidatedAt }, message: 'Sessions invalidated' });
  } catch (err) {
    sendRouteError(res, err);
  }
});

export default router;
