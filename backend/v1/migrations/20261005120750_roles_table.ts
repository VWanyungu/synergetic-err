import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('roles')) return;

  await knex.schema.createTable('roles', (table) => {
    table.uuid('attribute_id').primary();

    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE').index();

    table.string('role').notNullable();
    // 'program'/'project' exist for forward compatibility — this app has no programs/projects
    // tables, so the app only ever grants and checks 'global'.
    table.enum('scope_type', ['global', 'program', 'project']).notNullable();

    table.smallint('program_id').nullable().index();
    table.uuid('project_id').nullable().index();

    table.uuid('granted_by').notNullable().references('id').inTable('users');
    table.timestamp('granted_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.uuid('revoked_by').nullable().references('id').inTable('users');
    table.timestamp('revoked_at', { useTz: true }).nullable();
    table.string('revoke_reason', 10000).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('roles');
}
