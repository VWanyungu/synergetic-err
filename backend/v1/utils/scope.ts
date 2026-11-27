import db from '../database/dbSetup.js';

/** Matches no department, so a champion without one is scoped to nothing. */
const NO_DEPARTMENT = '00000000-0000-0000-0000-000000000000';

/** Roles that work inside one department. A Department Lead has exactly a Risk Champion's permissions. */
export const DEPARTMENT_ROLES = ['Risk Champion', 'Department Lead'];

/**
 * The one department a user is limited to, or null for everyone else. Admin and Risk Officer see every
 * department; a Risk Champion or Department Lead only their own.
 */
export async function scopedDepartment(userId: string): Promise<string | null> {
  const [user, roles] = await Promise.all([
    db('users').where({ id: userId }).first('department_id'),
    db('roles').where({ user_id: userId }).whereNull('revoked_at').pluck('role'),
  ]);
  const unrestricted = roles.includes('Admin') || roles.includes('Risk Officer');
  // A champion with no department must see nothing, never everything.
  return !unrestricted && roles.some((r) => DEPARTMENT_ROLES.includes(r)) ? (user?.department_id ?? NO_DEPARTMENT) : null;
}

/**
 * The one division a Division Lead may look at, or null for everyone else. A Division Lead is read-only and sees only the risks
 * affecting their division; one with no division sees nothing.
 */
export async function scopedDivision(userId: string): Promise<string | null> {
  const [user, roles] = await Promise.all([
    db('users').where({ id: userId }).first('division_id'),
    db('roles').where({ user_id: userId }).whereNull('revoked_at').pluck('role'),
  ]);
  const unrestricted = roles.some((r) => ['Admin', 'Risk Officer', ...DEPARTMENT_ROLES].includes(r));
  return !unrestricted && roles.includes('Division Lead') ? (user?.division_id ?? NO_DEPARTMENT) : null;
}

/** Both scopes from a single user and roles lookup (the register needs both; calling the two functions above reads them twice). */
export async function scopes(userId: string): Promise<{ department: string | null; division: string | null }> {
  const [user, roles] = await Promise.all([
    db('users').where({ id: userId }).first('department_id', 'division_id'),
    db('roles').where({ user_id: userId }).whereNull('revoked_at').pluck('role'),
  ]);
  const inDepartment = !roles.includes('Admin') && !roles.includes('Risk Officer');
  const departmentRole = roles.some((r) => DEPARTMENT_ROLES.includes(r));
  return {
    department: inDepartment && departmentRole ? (user?.department_id ?? NO_DEPARTMENT) : null,
    division: inDepartment && !departmentRole && roles.includes('Division Lead') ? (user?.division_id ?? NO_DEPARTMENT) : null,
  };
}

/** Express guard: a Division Lead gets a 403 here (dashboard, reports, heat map and so on are not theirs). */
export const denyDivisionLead: import('express').RequestHandler = async (req, res, next) => {
  try {
    if (await scopedDivision(req.user!.userId)) {
      res.status(403).json({ status: 'error', data: null, message: 'Not available for your role.' });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
};
