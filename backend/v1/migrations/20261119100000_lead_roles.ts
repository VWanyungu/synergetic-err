import type { Knex } from 'knex';

const ROLES = [
  // Same permissions as a Risk Champion, under the name some departments use.
  { name: 'Department Lead', sort_order: 4 },
  // Read-only, and only for the risks affecting their one division.
  { name: 'Division Lead', sort_order: 5 },
];

export async function up(knex: Knex): Promise<void> {
  await knex('access_role').insert(ROLES.map((r) => ({ ...r, is_system: true }))).onConflict('name').ignore();
  await knex.schema.alterTable('users', (t) => {
    t.uuid('division_id').references('id').inTable('divisions').onDelete('SET NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => t.dropColumn('division_id'));
  await knex('access_role').whereIn('name', ROLES.map((r) => r.name)).del();
}
