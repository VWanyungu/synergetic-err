import type { RequestHandler } from 'express';
import type { RoleName } from '../database/utils/database.js';

const deny = (res: Parameters<RequestHandler>[1]) =>
  res.status(403).json({ status: 'error', data: null, message: 'Not authorized' });

/** this app has no programs/projects, so every grant and every check here is global-scoped. */
export default function authorize(requiredRoles: RoleName[]): RequestHandler {
  return (req, res, next) => {
    const roles = req.user?.role;
    if (!roles) {
      res.status(403).json({ status: 'error', data: req.user, message: 'Authentication token not provided' });
      return;
    }

    const isAuthorized = roles.some(
      (grant) => grant.scope_type === 'global' && (grant.role === 'Admin' || requiredRoles.includes(grant.role)),
    );

    isAuthorized ? next() : deny(res);
  };
}
