import db from '../database/dbSetup.js';

/**
 * The one department a user is limited to, or null for everyone else. Admin and Risk Officer see every
 * department; a Risk Champion only their own.
 */
export async function scopedDepartment(userId: string): Promise<string | null> {
  const [user, roles] = await Promise.all([
    db('users').where({ id: userId }).first('department_id'),
    db('roles').where({ user_id: userId }).whereNull('revoked_at').pluck('role'),
  ]);
  const unrestricted = roles.includes('Admin') || roles.includes('Risk Officer');
  return !unrestricted && roles.includes('Risk Champion') ? (user?.department_id ?? null) : null;
}
