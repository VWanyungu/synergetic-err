import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('divisions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable().unique();
    table.string('code', 4).unique();
    table.string('description');
  });

  // Re-create risk_divisions to reference divisions(id) instead of departments(id)
  await knex.schema.dropTableIfExists('risk_divisions');

  await knex.schema.createTable('risk_divisions', (table) => {
    table.uuid('risk_id').notNullable().references('id').inTable('risks').onDelete('CASCADE');
    table.uuid('division_id').notNullable().references('id').inTable('divisions').onDelete('CASCADE');
    table.primary(['risk_id', 'division_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('risk_divisions');
  await knex.schema.dropTableIfExists('divisions');

  await knex.schema.createTable('risk_divisions', (table) => {
    table.uuid('risk_id').notNullable().references('id').inTable('risks').onDelete('CASCADE');
    table.uuid('department_id').notNullable().references('id').inTable('departments');
    table.primary(['risk_id', 'department_id']);
  });
}

