import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('risks', (table) => {
    table.text('description');
    table.date('next_review_date');
  });
  await knex.schema.createTable('risk_divisions', (table) => {
    table.uuid('risk_id').notNullable().references('id').inTable('risks').onDelete('CASCADE');
    table.uuid('department_id').notNullable().references('id').inTable('departments');
    table.primary(['risk_id', 'department_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('risk_divisions');
  await knex.schema.alterTable('risks', (table) => {
    table.dropColumns('description', 'next_review_date');
  });
}
