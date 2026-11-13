import type { Knex } from 'knex';

// Dev-only default password for seeded/admin-created users: "ChangeMe123!". They sign in
// with it and reset it via the forgot-password flow.
export const SEED_PASSWORD_HASH = '$2b$10$gbwN67cWlDxumd6j57UAYeXtxAFpPUE.RMEJ3EPm76FwozLIsIyVy';

export const USER_IDS = {
  ADMIN: '10000000-0000-0000-0000-000000000001',
};

export async function seed(knex: Knex): Promise<void> {
  await knex('users')
    .insert({
      id: USER_IDS.ADMIN,
      first_name: 'Admin',
      last_name: 'User',
      email: 'admin@err.local',
      username: 'admin',
      password_hash: SEED_PASSWORD_HASH,
      status: 'active',
      is_verified: true,
      updated_at: knex.fn.now(),
    })
    .onConflict('id')
    .merge({
      first_name: knex.raw('EXCLUDED.first_name'),
      last_name: knex.raw('EXCLUDED.last_name'),
      email: knex.raw('EXCLUDED.email'),
      password_hash: knex.raw('EXCLUDED.password_hash'),
      status: knex.raw('EXCLUDED.status'),
      username: knex.raw('EXCLUDED.username'),
      is_verified: knex.raw('EXCLUDED.is_verified'),
      updated_at: knex.fn.now(),
    });
}
