import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // A Risk Champion cannot archive a risk outright: they ask, and a Risk Officer decides.
  await knex.schema.createTable('archive_requests', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('risk_id').notNullable().references('id').inTable('risks').onDelete('CASCADE');
    t.uuid('requested_by').notNullable().references('id').inTable('users');
    t.string('status').notNullable().defaultTo('pending');
    t.uuid('decided_by').references('id').inTable('users');
    t.timestamp('decided_at');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.check("status IN ('pending', 'approved', 'rejected')", [], 'archive_requests_status_check');
  });
  await knex.raw(`create unique index archive_requests_one_pending on archive_requests (risk_id) where status = 'pending'`);

  await knex.schema.createTable('notifications', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('recipient_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('type').notNullable();
    t.string('title').notNullable();
    t.text('body').notNullable();
    t.uuid('risk_id').references('id').inTable('risks').onDelete('CASCADE');
    t.uuid('request_id').references('id').inTable('archive_requests').onDelete('CASCADE');
    t.timestamp('read_at');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.index(['recipient_id', 'created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('notifications');
  await knex.schema.dropTableIfExists('archive_requests');
}
