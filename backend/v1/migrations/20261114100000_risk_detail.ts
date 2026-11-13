import type { Knex } from 'knex';

const ROLES = [
  { name: 'Risk Champion', sort_order: 2 },
  { name: 'Risk Officer', sort_order: 3 },
];

export async function up(knex: Knex): Promise<void> {
  await knex('access_role').insert(ROLES.map((r) => ({ ...r, is_system: true }))).onConflict('name').ignore();

  await knex.schema.alterTable('users', (t) => {
    t.uuid('department_id').references('id').inTable('departments');
  });
  await knex.schema.alterTable('risks', (t) => {
    t.uuid('created_by').references('id').inTable('users');
  });
  await knex.schema.alterTable('mitigation_actions', (t) => {
    t.text('description');
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  // Everything that appears in the Overview timeline: comments and change events. `body` holds a comment's text;
  // `data` holds the facts of a change (field, from, to ...), so the sentence can be rebuilt without parsing text.
  await knex.schema.createTable('risk_activity', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('risk_id').notNullable().references('id').inTable('risks').onDelete('CASCADE');
    t.uuid('actor_id').references('id').inTable('users');
    t.string('type', 40).notNullable();
    t.text('body');
    t.jsonb('data').notNullable().defaultTo('{}');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('edited_at');
    t.index(['risk_id', 'created_at']);
  });
  // Earlier texts of an edited comment (the live text stays on risk_activity.body).
  await knex.schema.createTable('risk_comment_versions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('activity_id').notNullable().references('id').inTable('risk_activity').onDelete('CASCADE');
    t.text('body').notNullable();
    t.uuid('edited_by').references('id').inTable('users');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.index('activity_id');
  });
  // Every saved description, oldest first; the last one equals risks.description.
  await knex.schema.createTable('risk_description_versions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('risk_id').notNullable().references('id').inTable('risks').onDelete('CASCADE');
    t.text('body').notNullable();
    t.uuid('edited_by').references('id').inTable('users');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.index('risk_id');
  });
  // activity_id is null until the comment that carries the file is posted.
  await knex.schema.createTable('risk_attachments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('risk_id').notNullable().references('id').inTable('risks').onDelete('CASCADE');
    t.uuid('activity_id').references('id').inTable('risk_activity').onDelete('CASCADE');
    t.uuid('uploaded_by').references('id').inTable('users');
    t.string('name').notNullable();
    t.string('mime_type', 120);
    t.integer('bytes').notNullable();
    t.text('url').notNullable();
    t.string('public_id').notNullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.index('risk_id');
    t.index('activity_id');
  });
  // One row per risk per month: the rating at the last change that month (months with no change repeat the previous one).
  await knex.schema.createTable('risk_rating_snapshots', (t) => {
    t.uuid('risk_id').notNullable().references('id').inTable('risks').onDelete('CASCADE');
    t.date('month').notNullable();
    t.smallint('rating').notNullable();
    t.primary(['risk_id', 'month']);
  });
}

export async function down(knex: Knex): Promise<void> {
  for (const t of ['risk_rating_snapshots', 'risk_attachments', 'risk_description_versions', 'risk_comment_versions', 'risk_activity'])
    await knex.schema.dropTableIfExists(t);
  await knex.schema.alterTable('mitigation_actions', (t) => t.dropColumns('description', 'updated_at'));
  await knex.schema.alterTable('risks', (t) => t.dropColumn('created_by'));
  await knex.schema.alterTable('users', (t) => t.dropColumn('department_id'));
  await knex('access_role').whereIn('name', ROLES.map((r) => r.name)).del();
}
