import type { Knex } from 'knex';

// Foreign keys with no index: joins and cascade deletes on them scan the whole child table.
const FOREIGN_KEYS: [table: string, column: string][] = [
  ['"refreshTokens"', 'user_id'],
  ['archive_requests', 'decided_by'],
  ['archive_requests', 'requested_by'],
  ['archive_requests', 'risk_id'],
  ['mitigation_actions', 'owner_id'],
  ['notifications', 'request_id'],
  ['notifications', 'risk_id'],
  ['risk_activity', 'actor_id'],
  ['risk_attachments', 'uploaded_by'],
  ['risk_comment_versions', 'edited_by'],
  ['risk_description_versions', 'edited_by'],
  ['risk_divisions', 'division_id'],
  ['risks', 'created_by'],
  ['risks', 'owner_id'],
  ['roles', 'granted_by'],
  ['roles', 'revoked_by'],
  ['roles', 'role'],
  ['users', 'department_id'],
  ['users', 'division_id'],
];

const fkName = (table: string, column: string) => `${table.replaceAll('"', '')}_${column}_idx`;

// ILIKE '%q%' search (risk register and global search) and the register's default sorts.
const INDEXES = [
  `create index risks_title_trgm on risks using gin (title gin_trgm_ops)`,
  `create index risks_code_trgm on risks using gin (code gin_trgm_ops)`,
  `create index risks_category_trgm on risks using gin (category gin_trgm_ops)`,
  `create index mitigation_actions_title_trgm on mitigation_actions using gin (title gin_trgm_ops)`,
  `create index risks_active_created_idx on risks (created_at desc) where archived_at is null`,
  `create index risks_active_rating_idx on risks (rating desc, title) where archived_at is null`,
  `create index mitigation_actions_open_due_idx on mitigation_actions (due_date) where status <> 'completed'`,
];

export async function up(knex: Knex): Promise<void> {
  // pg_trgm is a trusted extension (Postgres 13+), so the database owner may create it.
  await knex.raw('create extension if not exists pg_trgm');
  for (const [table, column] of FOREIGN_KEYS) {
    await knex.raw(`create index ${fkName(table, column)} on ${table} (${column})`);
  }
  for (const sql of INDEXES) await knex.raw(sql);
}

export async function down(knex: Knex): Promise<void> {
  for (const sql of INDEXES) await knex.raw(`drop index ${sql.split(' ')[2]}`);
  for (const [table, column] of FOREIGN_KEYS) await knex.raw(`drop index ${fkName(table, column)}`);
}
