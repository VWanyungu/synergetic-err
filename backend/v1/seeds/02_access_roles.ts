import type { Knex } from 'knex';

// Mirrors the access_role migration's seed, so `knex seed:run` is self-contained after a
// fresh migrate cycle. is_system is deliberately not merged here — the migration's flag
// stays authoritative.
export const SEEDED_ACCESS_ROLES = [
  { name: 'Admin', sort_order: 1 },
  { name: 'Risk Champion', sort_order: 2 },
  { name: 'Risk Officer', sort_order: 3 },
];

export async function seed(knex: Knex): Promise<void> {
  await knex('access_role')
    .insert(SEEDED_ACCESS_ROLES.map((r) => ({ ...r, is_system: true, is_active: true })))
    .onConflict('name')
    .merge({ sort_order: knex.raw('EXCLUDED.sort_order') });
}
