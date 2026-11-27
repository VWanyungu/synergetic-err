import type { Knex } from 'knex';

const OLD = 'People - Talent, Licences, Labour, Welfare';

// Renames in place so its risks and users stay attached (a reseed would otherwise drop the old name).
export async function up(knex: Knex): Promise<void> {
  await knex('departments').where({ name: OLD }).update({ name: 'People' });
}

export async function down(knex: Knex): Promise<void> {
  await knex('departments').where({ name: 'People' }).update({ name: OLD });
}
