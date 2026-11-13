import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('users'))) {
    await knex.schema.createTable('users', (table) => {
      table.uuid('id').primary();
      table.string('external_id').unique();
      table.string('first_name').notNullable();
      table.string('last_name').notNullable();
      table.string('email').unique().notNullable().index();
      table.string('password_hash').notNullable();
      table.string('salt');
      table.string('phone_number').unique();
      table.enum('status', ['active', 'deactivated']).defaultTo('active');
      table.string('username').index();
      table.boolean('is_verified').notNullable().defaultTo(false);
      table.timestamp('last_login', { useTz: true });
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
}
