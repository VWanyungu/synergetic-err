import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('departments', (t) => t.string('description'));
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('departments', (t) => t.dropColumn('description'));
}
