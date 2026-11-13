import Joi from 'joi';
import type { CreateUserInput, AdminCreateUserInput, UpdateUserInput } from '../database/utils/database.js';

export const createUserSchema = Joi.object<CreateUserInput>({
  id: Joi.string().uuid().required(),
  firstName: Joi.string().trim().min(1).max(50).required(),
  lastName: Joi.string().trim().min(1).max(50).required(),
  email: Joi.string().email().lowercase().required(),
  passwordHash: Joi.string().required(),
  username: Joi.string().alphanum().min(3).max(30).required(),
});

export const userIdParamSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

// Role name existence/active-state is checked against the access_role table in the router
// handler (AccessRoles.getByName) — not hardcoded here, so roles added via the CRUD screen work.
const roleNameField = Joi.string().trim().min(1).max(50);

export const listUsersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().trim().max(200).optional(),
  globalRole: roleNameField.optional(),
  status: Joi.string().valid('active', 'deactivated').optional(),
});

export const adminCreateUserSchema = Joi.object<AdminCreateUserInput>({
  firstName: Joi.string().trim().min(1).max(50).required(),
  lastName: Joi.string().trim().min(1).max(50).required(),
  email: Joi.string().email().lowercase().required(),
  phone: Joi.string().trim().max(30).allow(null, '').optional(),
  globalRole: roleNameField.allow(null).optional(),
});

export const updateUserSchema = Joi.object<UpdateUserInput>({
  firstName: Joi.string().trim().min(1).max(50).optional(),
  lastName: Joi.string().trim().min(1).max(50).optional(),
  phone: Joi.string().trim().max(30).allow(null, '').optional(),
  globalRole: roleNameField.allow(null).optional(),
}).min(1);

export const setUserStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'deactivated').required(),
});

export interface CreateRoleBody {
  userId: string;
  role: string;
}

export const createRoleSchema = Joi.object<CreateRoleBody>({
  userId: Joi.string().uuid().required(),
  role: roleNameField.required(),
});

export interface RevokeRoleBody {
  reason?: string | null;
}

export const revokeRoleParamsSchema = Joi.object({
  attributeId: Joi.string().uuid().required(),
});

export const revokeRoleBodySchema = Joi.object<RevokeRoleBody>({
  reason: Joi.string().trim().max(10000).allow(null, '').optional(),
});

export interface ListRolesQuery {
  userId?: string;
  page?: number;
  limit?: number;
}

export const listRolesQuerySchema = Joi.object<ListRolesQuery>({
  userId: Joi.string().uuid().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

export interface CreateAccessRoleBody {
  name: string;
  sort_order: number;
  is_active?: boolean;
}

export interface UpdateAccessRoleBody {
  name?: string;
  sort_order?: number;
  is_active?: boolean;
}

export const createAccessRoleSchema = Joi.object<CreateAccessRoleBody>({
  name: Joi.string().trim().min(1).max(50).required(),
  sort_order: Joi.number().integer().min(0).max(32767).required(),
  is_active: Joi.boolean().optional(),
});

export const updateAccessRoleSchema = Joi.object<UpdateAccessRoleBody>({
  name: Joi.string().trim().min(1).max(50).optional(),
  sort_order: Joi.number().integer().min(0).max(32767).optional(),
  is_active: Joi.boolean().optional(),
}).min(1);

export const accessRoleIdParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

export interface ListAccessRolesQuery {
  includeInactive?: boolean;
}

export const listAccessRolesQuerySchema = Joi.object<ListAccessRolesQuery>({
  includeInactive: Joi.boolean().default(false),
});
