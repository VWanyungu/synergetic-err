import type { Knex } from 'knex';
import { USER_IDS } from './01_users.js';

export async function seed(knex: Knex): Promise<void> {
  await knex('roles')
    .insert({
      attribute_id: '30000000-0000-0000-0000-000000000001',
      user_id: USER_IDS.ADMIN,
      role: 'Admin',
      scope_type: 'global',
      program_id: null,
      project_id: null,
      granted_by: USER_IDS.ADMIN,
      granted_at: knex.fn.now(),
    })
    .onConflict('attribute_id')
    .merge({
      user_id: knex.raw('EXCLUDED.user_id'),
      role: knex.raw('EXCLUDED.role'),
      scope_type: knex.raw('EXCLUDED.scope_type'),
      granted_by: knex.raw('EXCLUDED.granted_by'),
      revoked_at: null,
      revoked_by: null,
      revoke_reason: null,
    });
}
