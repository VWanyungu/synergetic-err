import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('departments', (table) => {
    // Two-letter prefix used in risk codes such as IT-06.
    table.string('code', 4).unique();
  });

  await knex.schema.alterTable('risks', (table) => {
    table.string('code', 12).unique();
    table.string('status').notNullable().defaultTo('open');
    table.string('risk_response').notNullable().defaultTo('mitigate');
    table.timestamp('last_reviewed_at');
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.check("status IN ('open', 'in_progress', 'closed')", [], 'risks_status_check');
    table.check("risk_response IN ('mitigate', 'accept', 'transfer', 'avoid')", [], 'risks_risk_response_check');
    table.index('status');
  });

  await knex.schema.createTable('mitigation_actions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('risk_id').notNullable().references('id').inTable('risks').onDelete('CASCADE');
    table.string('title').notNullable();
    table.uuid('owner_id').references('id').inTable('users');
    table.string('status').notNullable().defaultTo('not_started');
    table.date('due_date');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.check("status IN ('not_started', 'in_progress', 'completed')", [], 'mitigation_actions_status_check');
    table.index('risk_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('mitigation_actions');
  await knex.schema.alterTable('risks', (table) => {
    table.dropColumns('code', 'status', 'risk_response', 'last_reviewed_at', 'updated_at');
  });
  await knex.schema.alterTable('departments', (table) => {
    table.dropColumn('code');
  });
}
