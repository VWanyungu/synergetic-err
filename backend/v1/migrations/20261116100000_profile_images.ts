import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.string('avatar_url', 500);
    t.string('banner_url', 500);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => t.dropColumns('avatar_url', 'banner_url'));
}
