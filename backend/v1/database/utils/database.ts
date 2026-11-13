import { randomUUID } from 'crypto';
import db from '../dbSetup.js';

export interface Paginated<T> {
  users: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface UserListItem {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  username: string | null;
  phone_number: string | null;
  status: 'active' | 'deactivated';
  is_verified: boolean;
  last_login: Date | null;
  created_at: Date;
  global_role: RoleName | null;
}

export interface UserDetail {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  status: 'active' | 'deactivated';
  global_role: RoleName | null;
  roles: RoleGrantRow[];
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  globalRole?: RoleName | null;
}

export interface AdminCreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  globalRole?: RoleName | null;
}

export interface UserAuthView {
  userId: string | null;
  email: string | null;
  passwordHash: string | null;
  firstName: string | null;
}

export interface CreateUserInput {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  username: string;
  isVerified?: boolean;
}

export interface UpdatePasswordInput {
  userId: string;
  passwordHash: string;
}

export class Users {
  static async getAllUsers({
    page = 1,
    limit = 10,
    search,
    globalRole,
    status,
  }: {
    page?: number;
    limit?: number;
    search?: string;
    globalRole?: RoleName;
    status?: 'active' | 'deactivated';
  }): Promise<Paginated<UserListItem> & { activeCount: number }> {
    const offset = (page - 1) * limit;
    const base = db('users');
    if (search) {
      const term = `%${search.toLowerCase()}%`;
      base.where((qb) => {
        qb.whereRaw('lower(first_name || \' \' || last_name) like ?', [term]).orWhereRaw('lower(email) like ?', [
          term,
        ]);
      });
    }
    if (status) base.where({ status });
    if (globalRole) {
      base.whereExists(
        db('roles')
          .whereRaw('roles.user_id = users.id')
          .andWhere({ role: globalRole, scope_type: 'global' })
          .whereNull('revoked_at'),
      );
    }

    const countRows = await base.clone().count<{ count: string }[]>('id as count');
    const total = Number(countRows[0]?.count ?? 0);
    const [activeRow] = await db('users').where({ status: 'active' }).count<{ count: string }[]>('id as count');
    const activeCount = activeRow?.count ?? '0';

    const rows = await base
      .clone()
      .select(
        'id',
        'first_name',
        'last_name',
        'email',
        'username',
        'phone_number',
        'status',
        'is_verified',
        'last_login',
        'created_at',
      )
      .limit(limit)
      .offset(offset)
      .orderBy('id');

    const ids = rows.map((r) => r.id);
    const roleRows = ids.length
      ? await db('roles')
          .select('user_id', 'role')
          .whereIn('user_id', ids)
          .andWhere({ scope_type: 'global' })
          .whereNull('revoked_at')
      : [];

    const users: UserListItem[] = rows.map((row) => ({
      ...row,
      global_role: roleRows.find((r) => r.user_id === row.id)?.role ?? null,
    }));

    return {
      users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      activeCount: Number(activeCount ?? 0),
    };
  }

  static async getUserById(id: string): Promise<UserDetail | null> {
    const user = await db('users')
      .select('id', 'first_name', 'last_name', 'email', 'phone_number', 'status')
      .where({ id })
      .first();
    if (!user) return null;

    const roles = await db('roles')
      .select('attribute_id', 'user_id', 'role', 'scope_type', 'program_id', 'project_id', 'granted_by', 'granted_at')
      .where({ user_id: id })
      .whereNull('revoked_at');

    const globalRoleRow = roles.find((r) => r.scope_type === 'global' && r.role !== 'Admin') ??
      roles.find((r) => r.scope_type === 'global');

    return { ...user, global_role: globalRoleRow ? globalRoleRow.role : null, roles };
  }

  static async updateUser(id: string, input: UpdateUserInput, actorId: string): Promise<UserDetail | null> {
    const patch: Record<string, unknown> = {};
    if (input.firstName !== undefined) patch.first_name = input.firstName;
    if (input.lastName !== undefined) patch.last_name = input.lastName;
    if (input.phone !== undefined) patch.phone_number = input.phone;
    if (Object.keys(patch).length) {
      patch.updated_at = db.fn.now();
      await db('users').where({ id }).update(patch);
    }
    if (input.globalRole !== undefined) {
      await Roles.setGlobalRole(id, input.globalRole, actorId);
    }
    return Users.getUserById(id);
  }

  static async setStatus(id: string, status: 'active' | 'deactivated'): Promise<UserDetail | null> {
    const affected = await db('users').where({ id }).update({ status, updated_at: db.fn.now() });
    if (!affected) return null;
    return Users.getUserById(id);
  }

  /** Marks every access token issued before now as invalid (checked against the token's
   *  `iat` in authenticateToken). Returns the cutoff so the caller can seed the cache
   *  immediately, or null if the user doesn't exist. */
  static async invalidateSessions(id: string): Promise<Date | null> {
    const [row] = await db('users')
      .where({ id })
      .update({ tokens_invalidated_at: db.fn.now(), updated_at: db.fn.now() })
      .returning<{ tokens_invalidated_at: Date }[]>('tokens_invalidated_at');
    return row ? row.tokens_invalidated_at : null;
  }

  static async getTokensInvalidatedAt(id: string): Promise<Date | null> {
    const row = await db('users').select('tokens_invalidated_at').where({ id }).first();
    return row?.tokens_invalidated_at ?? null;
  }

  static async createUserAdmin(
    input: AdminCreateUserInput,
    passwordHash: string,
    actorId: string,
  ): Promise<UserDetail | null> {
    const id = randomUUID();
    await db('users').insert({
      id,
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      password_hash: passwordHash,
      username: input.email.split('@')[0],
      phone_number: input.phone ?? null,
      status: 'active',
      is_verified: false,
    });
    if (input.globalRole) {
      await Roles.setGlobalRole(id, input.globalRole, actorId);
    }
    return Users.getUserById(id);
  }

  static async getSingleUserByEmail(email: string): Promise<UserAuthView> {
    const [user] = await db('users')
      .select<{ id: string; email: string; password_hash: string; first_name: string }[]>(
        'id',
        'email',
        'password_hash',
        'first_name',
      )
      .where('email', email);

    if (!user) return { userId: null, email: null, passwordHash: null, firstName: null };

    return { userId: user.id, email: user.email, passwordHash: user.password_hash, firstName: user.first_name };
  }

  static async createUser(input: CreateUserInput): Promise<{ userId: string; email: string }> {
    const [user] = await db('users')
      .insert({
        id: input.id,
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email,
        password_hash: input.passwordHash,
        username: input.username,
        is_verified: input.isVerified ?? false,
      })
      .returning<{ id: string; email: string }[]>(['id', 'email']);

    if (!user) throw new Error('Failed to create user');
    return { userId: user.id, email: user.email };
  }

  static async updateUserPassword(
    input: UpdatePasswordInput,
  ): Promise<{ status: 'success' | 'fail'; error: string | null }> {
    try {
      const affected = await db('users')
        .where('id', input.userId)
        .update({ password_hash: input.passwordHash });

      if (affected === 0) return { status: 'fail', error: 'User not found' };
      return { status: 'success', error: null };
    } catch (err) {
      return { status: 'fail', error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
}

export class Tokens {
  static async getRefreshToken(token: string): Promise<{ refreshToken: string | null }> {
    const [row] = await db('refreshTokens').select('refresh_token').where('refresh_token', token);
    return { refreshToken: row ? row.refresh_token : null };
  }

  static async storeRefreshToken(userId: string, token: string): Promise<void> {
    await db('refreshTokens').insert({ user_id: userId, refresh_token: token });
  }

  static async deleteRefreshToken(token: string): Promise<{ deletedToken: string | null }> {
    const [deleted] = await db('refreshTokens')
      .where('refresh_token', token)
      .del()
      .returning<{ refresh_token: string }[]>('refresh_token');
    return { deletedToken: deleted ? deleted.refresh_token : null };
  }

  static async deleteAllRefreshTokensForUser(userId: string): Promise<void> {
    await db('refreshTokens').where({ user_id: userId }).del();
  }

  static async blacklistToken(token: string): Promise<void> {
    await db('tokens').insert({ token }).onConflict('token').ignore();
  }

  static async checkBlacklistToken(token: string): Promise<boolean> {
    const row = await db('tokens').select('id').where('token', token).first();
    return !!row;
  }
}

/** Role names are DB-driven (see `access_role`), not a hardcoded union — any string the
 *  catalog accepts is valid. `scope_type`/`program_id`/`project_id` exist on the schema for
 *  forward compatibility, but this app has no programs/projects, so the app only ever grants
 *  and checks `global` roles. */
export type RoleName = string;
export type ScopeType = 'global' | 'program' | 'project';

export interface RoleGrant {
  role: RoleName;
  scope_type: ScopeType;
  program_id: number | null;
  project_id: string | null;
}

export interface RoleGrantRow extends RoleGrant {
  attribute_id: string;
  user_id: string;
  granted_by: string;
  granted_at: Date;
}

export class Roles {
  /** Replaces a user's single global role with the given one, or clears it. */
  static async setGlobalRole(userId: string, role: RoleName | null, actorId: string): Promise<void> {
    await db.transaction(async (trx) => {
      await trx('roles')
        .where({ user_id: userId, scope_type: 'global' })
        .whereNull('revoked_at')
        .update({ revoked_by: actorId, revoked_at: trx.fn.now(), revoke_reason: 'Replaced via admin global role change' });
      if (role) {
        await trx('roles').insert({
          attribute_id: randomUUID(),
          user_id: userId,
          role,
          scope_type: 'global',
          program_id: null,
          project_id: null,
          granted_by: actorId,
        });
      }
    });
  }

  static async getRoles(userId: string): Promise<RoleGrant[]> {
    return db('roles')
      .select('role', 'scope_type', 'program_id', 'project_id')
      .where({ user_id: userId })
      .whereNull('revoked_at');
  }

  static async grant(userId: string, role: RoleName, grantedBy: string): Promise<string> {
    const attributeId = randomUUID();
    await db('roles').insert({
      attribute_id: attributeId,
      user_id: userId,
      role,
      scope_type: 'global',
      program_id: null,
      project_id: null,
      granted_by: grantedBy,
    });
    return attributeId;
  }

  static async revoke(attributeId: string, revokedBy: string, reason: string | null): Promise<RoleGrantRow | null> {
    const [row] = await db('roles')
      .where({ attribute_id: attributeId })
      .whereNull('revoked_at')
      .update({ revoked_by: revokedBy, revoked_at: db.fn.now(), revoke_reason: reason })
      .returning(['attribute_id', 'user_id', 'role', 'scope_type', 'program_id', 'project_id', 'granted_by', 'granted_at']);
    return row ?? null;
  }

  static async list({
    userId,
    page = 1,
    limit = 10,
  }: { userId?: string; page?: number; limit?: number }): Promise<{
    roles: (RoleGrantRow & { first_name: string; last_name: string; email: string })[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    const base = db('roles').whereNull('revoked_at');
    if (userId) base.where({ user_id: userId });

    const countRows = await base.clone().count<{ count: string }[]>('attribute_id as count');
    const total = Number(countRows[0]?.count ?? 0);

    const roles = await base
      .clone()
      .join('users', 'users.id', 'roles.user_id')
      .select(
        'roles.attribute_id',
        'roles.user_id',
        'roles.role',
        'roles.scope_type',
        'roles.program_id',
        'roles.project_id',
        'roles.granted_by',
        'roles.granted_at',
        'users.first_name',
        'users.last_name',
        'users.email',
      )
      .orderBy('roles.granted_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);

    return { roles, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  static async getById(attributeId: string): Promise<RoleGrantRow | null> {
    const row = await db('roles')
      .select('attribute_id', 'user_id', 'role', 'scope_type', 'program_id', 'project_id', 'granted_by', 'granted_at')
      .where({ attribute_id: attributeId })
      .whereNull('revoked_at')
      .first();
    return row ?? null;
  }
}

export interface AccessRoleRow {
  access_role_id: number;
  name: string;
  is_system: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface AccessRoleCreateInput {
  name: string;
  sort_order: number;
  is_active?: boolean;
}

export interface AccessRoleUpdateInput {
  name?: string;
  sort_order?: number;
  is_active?: boolean;
}

/** Catalog of grantable role names backing the `roles` grant table's FK. */
export class AccessRoles {
  static async list({ includeInactive = false }: { includeInactive?: boolean } = {}): Promise<AccessRoleRow[]> {
    const base = db('access_role');
    if (!includeInactive) base.where({ is_active: true });
    return base.select('access_role_id', 'name', 'is_system', 'sort_order', 'is_active').orderBy('sort_order', 'asc');
  }

  static async getById(id: number): Promise<AccessRoleRow | null> {
    const row = await db('access_role').where({ access_role_id: id }).first();
    return row ?? null;
  }

  static async getByName(name: string): Promise<AccessRoleRow | null> {
    const row = await db('access_role').where({ name }).first();
    return row ?? null;
  }

  static async create(input: AccessRoleCreateInput): Promise<AccessRoleRow> {
    const [row] = await db('access_role')
      .insert({ ...input, is_active: input.is_active ?? true })
      .returning(['access_role_id', 'name', 'is_system', 'sort_order', 'is_active']);
    return row;
  }

  static async update(id: number, input: AccessRoleUpdateInput): Promise<AccessRoleRow | null> {
    const [row] = await db('access_role')
      .where({ access_role_id: id })
      .update(input)
      .returning(['access_role_id', 'name', 'is_system', 'sort_order', 'is_active']);
    return row ?? null;
  }

  static async deactivate(id: number): Promise<AccessRoleRow | null> {
    const [row] = await db('access_role')
      .where({ access_role_id: id })
      .update({ is_active: false })
      .returning(['access_role_id', 'name', 'is_system', 'sort_order', 'is_active']);
    return row ?? null;
  }
}
