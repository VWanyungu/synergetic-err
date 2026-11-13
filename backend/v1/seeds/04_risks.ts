import type { Knex } from 'knex';
import { SEED_PASSWORD_HASH } from './01_users.js';

// Dev-only demo data for the risk distribution and risk register pages.
const DEPARTMENTS: [name: string, code: string, description: string][] = [
  ['Legal', 'LG', 'Contracts, licences and regulatory exposure.'],
  ['Projects', 'PR', 'Delivery schedules, handovers and project controls.'],
  ['IT', 'IT', 'Systems, data and cyber security risks.'],
  ['Development Management', 'DM', 'Approvals, land and development pipeline risks.'],
  ['Mechanical', 'ME', 'Plant, equipment and spare-parts supply.'],
  ['Civil', 'CV', 'Structures, roads and inspection records.'],
  ['Electrical', 'EL', 'Substations, protection systems and power supply.'],
  ['TLM', 'TL', 'Transmission lines, field crews and maintenance.'],
  ['Corporate Services', 'CS', 'Finance, leases and administration.'],
];

const OWNERS = [
  { id: '10000000-0000-0000-0000-000000000011', first: 'Wanjiru', last: 'Otieno', email: 'wanjiru.otieno@err.local' },
  { id: '10000000-0000-0000-0000-000000000012', first: 'Daniel', last: 'Mwangi', email: 'daniel.mwangi@err.local' },
  { id: '10000000-0000-0000-0000-000000000013', first: 'Peter', last: 'Njoroge', email: 'peter.njoroge@err.local' },
  { id: '10000000-0000-0000-0000-000000000014', first: 'Brian', last: 'Kiprono', email: 'brian.kiprono@err.local' },
  { id: '10000000-0000-0000-0000-000000000015', first: 'Achieng', last: 'Ouma', email: 'achieng.ouma@err.local' },
  { id: '10000000-0000-0000-0000-000000000016', first: 'Faith', last: 'Chebet', email: 'faith.chebet@err.local' },
  { id: '10000000-0000-0000-0000-000000000017', first: 'Grace', last: 'Wambui', email: 'grace.wambui@err.local' },
];

// department -> [title, category, likelihood, impact][]. Order decides the risk code (IT-01, IT-02, ...).
const RISKS: Record<string, [string, string, number, number][]> = {
  Legal: [
    ['Tender documents shared over personal email', 'Legal and compliance', 4, 4],
    ['Contract renewals tracked in spreadsheets', 'Legal and compliance', 3, 2],
    ['Expired contractor licences across regional offices', 'Legal and compliance', 3, 5],
    ['Regulatory filing deadlines missed', 'Legal and compliance', 1, 5],
    ['Data protection registration lapses', 'Legal and compliance', 2, 4],
    ['Unsigned subcontractor agreements', 'Legal and compliance', 2, 3],
  ],
  Projects: [
    ['Delayed handover of the Athi River project site', 'Project delivery', 3, 5],
    ['Scope creep on framework call-offs', 'Project delivery', 4, 3],
    ['Contractor insolvency mid-project', 'Project delivery', 2, 5],
    ['Unapproved variation orders', 'Project delivery', 3, 3],
    ['Land access disputes on the Kisumu line', 'Project delivery', 3, 4],
    ['Late community consultations', 'Project delivery', 2, 3],
    ['Weak cost reporting on active projects', 'Finance', 3, 3],
    ['Handover documents incomplete', 'Project delivery', 4, 2],
    ['Site safety induction not enforced', 'People', 2, 5],
  ],
  IT: [
    ['Legacy VPN lacks multi-factor authentication', 'Cyber and technology', 2, 5],
    ['Backup restores not tested quarterly', 'Cyber and technology', 3, 3],
    ['Single internet provider at head office', 'Operations', 3, 2],
    ['Shared admin accounts on core systems', 'Cyber and technology', 3, 4],
    ['Phishing awareness training overdue', 'People', 4, 3],
    ['Unpatched ERP servers exposed to ransomware', 'Cyber and technology', 4, 4],
    ['End-of-life laptops still in use', 'Cyber and technology', 3, 2],
    ['No disaster recovery site', 'Cyber and technology', 2, 5],
  ],
  'Development Management': [
    ['Permit approvals outside agreed timelines', 'Legal and compliance', 3, 4],
    ['Dependence on a single development partner', 'Operations', 2, 4],
    ['Inconsistent project appraisal templates', 'Project delivery', 4, 2],
    ['Stakeholder commitments not tracked', 'Project delivery', 3, 3],
    ['Unfunded pipeline projects', 'Finance', 3, 4],
  ],
  Mechanical: [
    ['Single supplier for turbine spare parts', 'Supply chain', 3, 4],
    ['Plant maintenance backlog', 'Operations', 4, 3],
    ['Lubricant stock-outs at remote sites', 'Supply chain', 2, 2],
    ['Calibration records kept on paper', 'Operations', 3, 2],
  ],
  Civil: [
    ['Ageing culvert inspection records', 'Operations', 3, 3],
    ['Substandard aggregate deliveries', 'Supply chain', 2, 4],
    ['Flood damage to access roads', 'Operations', 3, 5],
  ],
  Electrical: [
    ['Substation protection relay calibration overdue', 'Operations', 2, 5],
    ['Transformer oil testing gaps', 'Operations', 3, 3],
    ['Lightning protection not audited', 'Operations', 2, 4],
    ['Spare cable stock below minimum', 'Supply chain', 3, 2],
  ],
  TLM: [
    ['Staff turnover in the transmission line team', 'People', 2, 3],
    ['Vandalism of tower components', 'Operations', 3, 4],
    ['Right-of-way encroachment', 'Legal and compliance', 4, 3],
    ['Climbing equipment certification lapses', 'People', 2, 5],
    ['Patrol records not digitised', 'Operations', 3, 2],
  ],
  'Corporate Services': [
    ['Office lease renewal terms unclear', 'Finance', 2, 2],
    ['Procurement controls not enforced on framework contracts', 'Finance', 4, 4],
    ['Key staff succession gaps in finance', 'People', 2, 4],
    ['Fleet insurance cover below asset value', 'Finance', 2, 3],
  ],
};

const GENERIC_ACTIONS = [
  'Document the current controls',
  'Brief the department head',
  'Agree an owner and review date',
  'Run a tabletop exercise',
  'Close the audit finding',
];

const DAY = 86_400_000;
const daysFromNow = (d: number) => new Date(Date.now() + d * DAY);

export async function seed(knex: Knex): Promise<void> {
  for (const o of OWNERS) {
    await knex('users')
      .insert({
        id: o.id,
        first_name: o.first,
        last_name: o.last,
        email: o.email,
        username: o.email.split('@')[0],
        password_hash: SEED_PASSWORD_HASH,
        status: 'active',
        is_verified: true,
      })
      .onConflict('id')
      .ignore();
  }

  // Reseeding replaces the demo catalogue; departments that are not in the design go too.
  await knex('risks').del();
  await knex('departments').whereNotIn('name', DEPARTMENTS.map(([name]) => name)).del();
  for (const [name, code, description] of DEPARTMENTS) {
    await knex('departments').insert({ name, code, description }).onConflict('name').merge({ code, description });
  }
  const dept = Object.fromEntries((await knex('departments').select('id', 'name')).map((d) => [d.name, d.id]));
  const adminActions: [string, string, number | null][] = [
    ['Patch and isolate ERP servers', 'in_progress', 33],
    ['Failover for payroll and procurement data', 'not_started', 64],
  ];

  let n = 0;
  for (const [department, items] of Object.entries(RISKS)) {
    const code = DEPARTMENTS.find(([name]) => name === department)![1];
    for (const [i, [title, category, likelihood, impact]] of items.entries()) {
      n++;
      const owner = OWNERS[n % OWNERS.length]!;
      // Spread statuses, review dates and the odd gap so every quick filter has something to find.
      const status = n % 9 === 0 ? 'closed' : n % 5 === 0 ? 'in_progress' : 'open';
      const [risk] = await knex('risks')
        .insert({
          code: `${code}-${String(i + 1).padStart(2, '0')}`,
          title,
          category,
          department_id: dept[department],
          owner_id: n % 11 === 0 ? null : owner.id,
          likelihood,
          impact,
          status,
          risk_response: (['mitigate', 'mitigate', 'accept', 'transfer', 'avoid'] as const)[n % 5],
          last_reviewed_at: daysFromNow(-((n * 7) % 140)),
          updated_at: daysFromNow(-((n * 3) % 40)),
          archived_at: n % 17 === 0 ? daysFromNow(-10) : null,
          created_at: daysFromNow(-200 + n),
        })
        .returning('id');

      const actions =
        title.startsWith('Unpatched ERP')
          ? adminActions.map(([t, s, d]) => ({ title: t, status: s, due: daysFromNow(d!), owner: OWNERS[3]!.id }))
          : n % 4 === 3
            ? []
            : Array.from({ length: 1 + (n % 2) }, (_, k) => ({
                title: GENERIC_ACTIONS[(n + k) % GENERIC_ACTIONS.length]!,
                status: (['not_started', 'in_progress', 'completed'] as const)[(n + k) % 3],
                // Every few actions land in the past so "Overdue actions" has results.
                due: daysFromNow(n % 3 === 0 ? -(10 + k) : 20 + n + k),
                owner: owner.id,
              }));
      if (actions.length === 0) continue;
      await knex('mitigation_actions').insert(
        actions.map((a) => ({ risk_id: risk.id, title: a.title, status: a.status, due_date: a.due, owner_id: a.owner })),
      );
    }
  }
}
