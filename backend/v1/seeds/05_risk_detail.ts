import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import { USER_IDS } from './01_users.js';

// Dev-only demo data for the risk detail pages: who works where, descriptions, timeline, plan details, rating history.
// Runs after 04_risks.ts, which recreates the risks (and so wipes everything hung off them).

const u = (n: number) => `10000000-0000-0000-0000-0000000000${n}`;
const WANJIRU = u(11), DANIEL = u(12), PETER = u(13), BRIAN = u(14), ACHIENG = u(15), FAITH = u(16), GRACE = u(17), KEVIN = u(18);

// user -> [role, department] (Daniel oversees every department, so no department).
const PEOPLE: [string, string, string | null][] = [
  [WANJIRU, 'Risk Champion', 'IT'],
  [DANIEL, 'Risk Officer', null],
  [PETER, 'Risk Champion', 'Legal'],
  [BRIAN, 'Risk Champion', 'Finance'],
  [ACHIENG, 'Risk Champion', 'Projects'],
  [FAITH, 'Risk Champion', 'People - Talent, Licences, Labour, Welfare'],
  [GRACE, 'Risk Champion', 'HSSE'],
  [KEVIN, 'Risk Champion', 'Commercial'],
];

const at = (iso: string) => new Date(`${iso}T09:00:00+03:00`);
const DAY = 86_400_000;
const monthStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const addMonths = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));

const ERP_V1 = 'Three ERP application servers are two patch cycles behind. A ransomware infection could stop procurement and payroll for several days.';
const ERP_V2 = 'Three ERP application servers are two patch cycles behind. A ransomware infection could stop procurement and payroll for several days.';
const ERP_V3 = 'Three ERP application servers are two patch cycles behind. A ransomware infection could stop procurement and payroll processing for up to a week. The backup restore process has not been tested since March.';

export async function seed(knex: Knex): Promise<void> {
  const dept = Object.fromEntries((await knex('departments').select('id', 'name')).map((d) => [d.name, d.id as string]));
  const div = Object.fromEntries((await knex('divisions').select('id', 'name')).map((d) => [d.name, d.id as string]));
  const deptName = Object.fromEntries(Object.entries(dept).map(([n, id]) => [id, n]));

  for (const [id, role, dep] of PEOPLE) {
    await knex('users').where({ id }).update({ department_id: dep ? dept[dep] : null });
    await knex('roles').where({ user_id: id }).del();
    await knex('roles').insert({
      attribute_id: randomUUID(), user_id: id, role, scope_type: 'global', granted_by: USER_IDS.ADMIN,
    });
  }
  const champion: Record<string, string> = {};
  for (const [id, role, dep] of PEOPLE) if (role === 'Risk Champion' && dep) champion[dept[dep]!] = id;

  const risks = await knex('risks').select('id', 'code', 'title', 'department_id', 'owner_id', 'rating', 'created_at', 'last_reviewed_at');
  const now = new Date();
  const activity: object[] = [];
  const versions: object[] = [];
  const snapshots: object[] = [];

  risks.forEach((r, n) => {
    const isErp = r.title.startsWith('Unpatched ERP');
    const author = isErp ? WANJIRU : champion[r.department_id] ?? r.owner_id ?? DANIEL;
    const created: Date = isErp ? at('2026-10-28') : r.created_at;
    const reviewed: Date | null = isErp ? at('2026-11-03') : r.last_reviewed_at;
    const description = isErp
      ? ERP_V3
      : `${r.title}. Raised at the ${deptName[r.department_id] ?? 'departmental'} risk review; the cause and likely impact are still being assessed.`;

    risks[n] = { ...r, _author: author, _created: created, _reviewed: reviewed, _description: description } as typeof r;
  });

  for (const r of risks as (typeof risks[number] & { _author: string; _created: Date; _reviewed: Date | null; _description: string })[]) {
    const n = risks.indexOf(r);
    const isErp = r.title.startsWith('Unpatched ERP');
    await knex('risks').where({ id: r.id }).update({
      created_by: r._author,
      description: r._description,
      created_at: r._created,
      last_reviewed_at: r._reviewed,
      next_review_date: isErp ? '2026-11-26' : new Date((r._reviewed ?? r._created).getTime() + 90 * DAY).toISOString().slice(0, 10),
    });

    if (isErp) {
      versions.push(
        { risk_id: r.id, body: ERP_V1, edited_by: WANJIRU, created_at: at('2026-10-28') },
        { risk_id: r.id, body: ERP_V2, edited_by: WANJIRU, created_at: at('2026-10-30') },
        { risk_id: r.id, body: ERP_V3, edited_by: DANIEL, created_at: at('2026-11-03') },
      );
    } else {
      versions.push({ risk_id: r.id, body: r._description, edited_by: r._author, created_at: r._created });
    }

    // A minute apart per event so same-day entries keep the order they are written in.
    let tick = 0;
    const ev = (type: string, actor: string, when: Date, data: object = {}, body: string | null = null) =>
      activity.push({ risk_id: r.id, actor_id: actor, type, data: JSON.stringify(data), body, created_at: new Date(when.getTime() + tick++ * 60_000) });

    // Review history feeds the dashboard's monthly review compliance.
    if (r._reviewed) ev('reviewed', r.owner_id ?? r._author, r._reviewed);

    if (isErp) {
      ev('owner_changed', WANJIRU, at('2026-10-28'), { to: 'Wanjiru Otieno' });
      ev('next_review_changed', WANJIRU, at('2026-10-28'), { to: '2026-11-26' });
      ev('rating_changed', WANJIRU, at('2026-10-29'), { field: 'impact', from: 3, to: 4, rating: 12 });
      ev('division_added', WANJIRU, at('2026-10-29'), { name: 'TLM' });
      ev('rating_changed', WANJIRU, at('2026-10-30'), { field: 'likelihood', from: 3, to: 4, rating: 16 });
      ev('comment', WANJIRU, at('2026-10-30'), {}, 'The vendor has rated both missing patches as critical, so I raised likelihood from 3 to 4. Patch window requested for 7 Nov.');
      ev('mitigation_status', WANJIRU, at('2026-11-02'), { plan: 'Patch and isolate ERP servers', from: 'not_started', to: 'in_progress' });
      ev('description_edited', DANIEL, at('2026-11-03'));
      ev('division_added', DANIEL, at('2026-11-03'), { name: 'Corporate Services' });
      ev('comment', DANIEL, at('2026-11-03'), {}, 'Discussed at the October review. Keep this at High until the restore test passes, and post the test result here when it is done.');
    } else {
      if (n % 2 === 0) ev('comment', DANIEL, new Date(r._created.getTime() + 3 * DAY), {}, 'Reviewed with the department head. Owner to confirm the mitigation dates before the next review.');
      if (n % 3 === 0) ev('rating_changed', r._author, new Date(r._created.getTime() + 20 * DAY), { field: 'likelihood', from: 2, to: 3, rating: r.rating });
    }

    // Rating history: a deterministic walk that ends on today's rating. Created-month onward, one row per month.
    const first = isErp ? new Date(Date.UTC(2025, 11, 1)) : monthStart(r._created);
    const last = monthStart(now);
    const months: Date[] = [];
    for (let m = first; m <= last; m = addMonths(m, 1)) months.push(m);
    const erp = [6, 6, 8, 9, 9, 12, 12, 10, 15, 20, 20, 16];
    months.forEach((m, i) => {
      const fromEnd = months.length - 1 - i;
      const rating = isErp ? erp[i]! : Math.min(25, Math.max(1, r.rating + (fromEnd === 0 ? 0 : ((n + fromEnd * 3) % 7) - 3)));
      snapshots.push({ risk_id: r.id, month: m.toISOString().slice(0, 10), rating });
    });
  }

  // Spread risks across divisions so all division registers have meaningful data
  const divIds = Object.values(div) as string[];
  const links: { risk_id: string; division_id: string }[] = [];
  risks.forEach((r, n) => {
    if (r.title.startsWith('Unpatched ERP')) return;
    if (divIds.length) {
      links.push({ risk_id: r.id, division_id: divIds[n % divIds.length]! });
      if (n % 2 === 0) {
        links.push({ risk_id: r.id, division_id: divIds[(n + 3) % divIds.length]! });
      }
    }
  });
  const seen = new Set<string>();
  const unique = links.filter((l) => !seen.has(l.risk_id + l.division_id) && seen.add(l.risk_id + l.division_id));
  for (let i = 0; i < unique.length; i += 200) await knex('risk_divisions').insert(unique.slice(i, i + 200)).onConflict(['risk_id', 'division_id']).ignore();

  for (let i = 0; i < activity.length; i += 200) await knex('risk_activity').insert(activity.slice(i, i + 200));
  for (let i = 0; i < versions.length; i += 200) await knex('risk_description_versions').insert(versions.slice(i, i + 200));
  for (let i = 0; i < snapshots.length; i += 500) await knex('risk_rating_snapshots').insert(snapshots.slice(i, i + 500));

  // Mitigation plan detail, and the people the ERP plans belong to in the design.
  await knex.raw(`update mitigation_actions m set created_at = r.created_at from risks r where r.id = m.risk_id`);
  await knex.raw(`update mitigation_actions set description = 'Agreed with the department head; owner to report progress at the next review.', updated_at = created_at`);
  const [erp] = await knex('risks').where('title', 'like', 'Unpatched ERP%').select('id');
  if (erp) {
    await knex('mitigation_actions').where({ risk_id: erp.id, title: 'Patch and isolate ERP servers' }).update({
      description: 'Apply the outstanding vendor patches, move the ERP servers onto an isolated subnet, and run a full restore test from backup.',
      owner_id: BRIAN, updated_at: at('2026-11-02'),
    });
    await knex('mitigation_actions').where({ risk_id: erp.id, title: 'Failover for payroll and procurement data' }).update({
      description: 'Move payroll and procurement data to the secondary data centre and document the failover steps.',
      owner_id: WANJIRU, updated_at: at('2026-11-03'),
    });
    if (div['TLM'] && div['Corporate Services']) {
      await knex('risk_divisions').insert([
        { risk_id: erp.id, division_id: div['TLM'] },
        { risk_id: erp.id, division_id: div['Corporate Services'] },
      ]).onConflict(['risk_id', 'division_id']).ignore();
    }
  }
}
