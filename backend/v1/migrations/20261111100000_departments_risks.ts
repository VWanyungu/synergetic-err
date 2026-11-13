import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('departments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable().unique();
  });

  await knex.schema.createTable('risks', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('title').notNullable();
    table.string('category').notNullable();
    table.uuid('department_id').notNullable().references('id').inTable('departments');
    table.uuid('owner_id').references('id').inTable('users');
    table.smallint('likelihood').notNullable();
    table.smallint('impact').notNullable();
    // BR-01: rating is always computed, never entered.
    table.specificType('rating', 'smallint GENERATED ALWAYS AS (likelihood * impact) STORED');
    table.timestamp('archived_at');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.check('likelihood BETWEEN 1 AND 5');
    table.check('impact BETWEEN 1 AND 5');
    table.index('department_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('risks');
  await knex.schema.dropTableIfExists('departments');
}
