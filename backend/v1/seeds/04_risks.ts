import type { Knex } from 'knex';
import { SEED_PASSWORD_HASH } from './01_users.js';

export const DEPARTMENTS: [name: string, code: string, description: string][] = [
  ['People - Talent, Licences, Labour, Welfare', 'PPL', 'Workforce talent, professional licences, labour relations and employee welfare.'],
  ['Legal', 'LEG', 'Contracts, statutory compliance, litigation and regulatory exposure.'],
  ['Finance', 'FIN', 'Treasury, financial controls, budgeting, liquidity and accounting.'],
  ['IT', 'IT', 'Information systems, network infrastructure, data governance and cybersecurity.'],
  ['Projects', 'PRJ', 'Capital project delivery, contract variations, schedules and handovers.'],
  ['HSSE', 'HSE', 'Health, workplace safety, site security and environmental sustainability.'],
  ['Commercial', 'COM', 'Off-take contracts, power purchase agreements, customer relations and tariff risks.'],
  ['Supply Chain', 'SCM', 'Procurement, vendor reliability, logistics, warehousing and spares.'],
];

export const DIVISIONS: [name: string, code: string, description: string][] = [
  ['Development Management', 'DM', 'Approvals, permits, land acquisition and development pipeline.'],
  ['Mechanical', 'ME', 'Plant equipment, turbines, mechanical maintenance and spare parts.'],
  ['Civil', 'CV', 'Civil infrastructure, access roads, structures, foundations and drainage.'],
  ['Electrical', 'EL', 'Substations, protection relays, transformers and grid connections.'],
  ['TLM', 'TL', 'Transmission lines, towers, wayleaves and line maintenance crews.'],
  ['Corporate Services', 'CS', 'Corporate administration, facilities management and business support.'],
];

export const RISK_CATEGORIES = [
  'Strategic',
  'Financial',
  'Operational',
  'Compliance & Legal',
  'Reputational',
  'Technology & Cybersecurity',
  'People & Human Capital',
  'Supply Chain & Procurement',
  'HSSE',
  'External Market',
  'ESG',
  'Project',
] as const;

export const OWNERS = [
  { id: '10000000-0000-0000-0000-000000000011', first: 'Wanjiru', last: 'Otieno', email: 'wanjiru.otieno@err.local' },
  { id: '10000000-0000-0000-0000-000000000012', first: 'Daniel', last: 'Mwangi', email: 'daniel.mwangi@err.local' },
  { id: '10000000-0000-0000-0000-000000000013', first: 'Peter', last: 'Njoroge', email: 'peter.njoroge@err.local' },
  { id: '10000000-0000-0000-0000-000000000014', first: 'Brian', last: 'Kiprono', email: 'brian.kiprono@err.local' },
  { id: '10000000-0000-0000-0000-000000000015', first: 'Achieng', last: 'Ouma', email: 'achieng.ouma@err.local' },
  { id: '10000000-0000-0000-0000-000000000016', first: 'Faith', last: 'Chebet', email: 'faith.chebet@err.local' },
  { id: '10000000-0000-0000-0000-000000000017', first: 'Grace', last: 'Wambui', email: 'grace.wambui@err.local' },
  { id: '10000000-0000-0000-0000-000000000018', first: 'Kevin', last: 'Mutua', email: 'kevin.mutua@err.local' },
];

const RISKS: Record<string, [string, string, number, number][]> = {
  'People - Talent, Licences, Labour, Welfare': [
    ['Engineering talent turnover and key person dependency', 'People & Human Capital', 4, 4],
    ['Mandatory professional practising licences lapse', 'Compliance & Legal', 3, 5],
    ['Collective bargaining agreement negotiation deadlock', 'Operational', 3, 4],
    ['Field staff mental health and welfare support gaps', 'People & Human Capital', 2, 3],
    ['Technical succession planning gaps across regional depots', 'Strategic', 3, 4],
    ['Remote accommodation living standards compliance', 'ESG', 2, 4],
  ],
  Legal: [
    ['Tender documents shared over personal email without encryption', 'Compliance & Legal', 4, 4],
    ['Contract renewals tracked in spreadsheets', 'Operational', 3, 2],
    ['Expired contractor operating licences across regional offices', 'Compliance & Legal', 3, 5],
    ['Regulatory filing deadlines missed', 'Compliance & Legal', 1, 5],
    ['Data protection registration and privacy policy lapses', 'Compliance & Legal', 2, 4],
    ['Unsigned subcontractor agreements and liability indemnities', 'Reputational', 2, 3],
  ],
  Finance: [
    ['Forex currency volatility on foreign capital expenditure', 'Financial', 4, 5],
    ['Delayed milestone billing and contractor retention releases', 'Financial', 3, 4],
    ['Inadequate debt covenant headroom under high interest rates', 'Financial', 2, 5],
    ['Office lease renewal terms and escalation clause misalignment', 'Financial', 2, 2],
    ['Incomplete fixed-asset physical register reconciliation', 'Compliance & Legal', 3, 3],
    ['Fiscal policy changes and withholding tax audit exposure', 'External Market', 3, 4],
  ],
  IT: [
    ['Legacy VPN lacks multi-factor authentication', 'Technology & Cybersecurity', 2, 5],
    ['Backup restores not tested quarterly across core systems', 'Technology & Cybersecurity', 3, 3],
    ['Single internet provider redundancy gap at head office', 'Technology & Cybersecurity', 3, 2],
    ['Shared admin accounts on core supervisory systems', 'Technology & Cybersecurity', 3, 4],
    ['Phishing awareness training overdue', 'People & Human Capital', 4, 3],
    ['Unpatched ERP servers exposed to ransomware', 'Technology & Cybersecurity', 4, 4],
    ['End-of-life laptops and network switches still in use', 'Technology & Cybersecurity', 3, 2],
    ['Absence of synchronous secondary disaster recovery site', 'Technology & Cybersecurity', 2, 5],
  ],
  Projects: [
    ['Delayed handover of the Athi River project site', 'Project', 3, 5],
    ['Scope creep on framework engineering call-offs', 'Project', 4, 3],
    ['Contractor insolvency mid-execution on major transmission line', 'Strategic', 2, 5],
    ['Unapproved variation orders exceeding contingency budget', 'Financial', 3, 3],
    ['Land access and wayleave disputes along pipeline corridor', 'ESG', 3, 4],
    ['Late community consultations leading to project site blockade', 'Reputational', 2, 3],
    ['Incomplete as-built handover documentation before commissioning', 'Project', 4, 2],
    ['Site safety induction not enforced for third-party subcontractors', 'HSSE', 2, 5],
  ],
  HSSE: [
    ['High-voltage substation arc-flash safety audit gaps', 'HSSE', 2, 5],
    ['Climbing equipment safety recertification lapses for tower crews', 'HSSE', 2, 5],
    ['Hazardous transformer oil handling and disposal compliance', 'ESG', 2, 4],
    ['Physical security breaches and vandalism at unmanned stations', 'Operational', 3, 4],
    ['Vehicle fleet road safety and speed telemetry enforcement gaps', 'HSSE', 3, 4],
    ['Emergency evacuation response drills overdue at central depot', 'HSSE', 2, 3],
  ],
  Commercial: [
    ['Off-taker default on bulk energy purchase agreements', 'Financial', 2, 5],
    ['Grid tariff renegotiation delays by energy regulator', 'External Market', 3, 4],
    ['Key industrial customer defection to captive off-grid solar', 'Strategic', 3, 4],
    ['Adverse public perception regarding transmission route impacts', 'Reputational', 3, 4],
    ['Cross-border electricity trading price volatility', 'Financial', 3, 3],
    ['Inaccurate bulk metering calibration leading to unbilled losses', 'Operational', 4, 3],
  ],
  'Supply Chain': [
    ['Single supplier dependency for critical turbine spare parts', 'Supply Chain & Procurement', 4, 4],
    ['Port clearance demurrage delays for imported electrical switchgear', 'Supply Chain & Procurement', 3, 4],
    ['Substandard aggregate deliveries failing civil structural tests', 'Supply Chain & Procurement', 2, 4],
    ['Strategic spare parts inventory buffer falling below safety levels', 'Operational', 3, 4],
    ['Critical vendor modern slavery and environmental audit failure', 'ESG', 2, 4],
    ['Lubricant and fuel stock-outs at remote line construction sites', 'Supply Chain & Procurement', 2, 3],
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

  // Seed divisions
  await knex('divisions').whereNotIn('name', DIVISIONS.map(([name]) => name)).del();
  for (const [name, code, description] of DIVISIONS) {
    await knex('divisions').insert({ name, code, description }).onConflict('name').merge({ code, description });
  }

  // Reseeding replaces the demo catalogue; departments that are not in the design go too.
  await knex('risks').del();
  await knex('users').whereIn('department_id', knex('departments').whereNotIn('name', DEPARTMENTS.map(([name]) => name)).select('id')).update({ department_id: null });
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
