# Enterprise Risk Register (ERR) Portal — Build Reference

Condensed from `SRS.md` (full SRS, revision 0.5) for day-to-day development use. It drops the decision log, traceability matrix, business-objective narrative, release plan, and sign-off artifacts — see `SRS.md` for the full history of *why* each requirement was decided, and for anything needed for stakeholder sign-off. Every ID here (FR-/BR-/NFR-/SCR-) is identical to the full SRS, so the two stay cross-referenceable.

**Tag legend:** **[C]** confirmed · **[P]** analyst-proposed, approved by default unless flagged · **[TBD]** open, see "Open Items" at the end · **[D]** deferred · **[OUT]** out of scope.

---

## Context

The organisation currently tracks risk manually in a shared Excel workbook (8 department tabs + two disconnected enterprise rollups), with no change history and fragile cross-sheet formulas. This portal replaces that process from scratch, on the organisation's approved stack (TypeScript, React, PostgreSQL + Knex, Better Auth — NFR-MAINT-01). The business approver is Fidelis Wanalwenge (Strategic Finance Unit).

---

## Scope

**In scope:** department-scoped risk register with dual identifiers (system UUID + stable org ID like `IT-01`); risk scoring via Impact × Likelihood with corrected bands; structured mitigation plans (owner/due date/status); append-only comments; full field-level audit history; cross-department risk transfer (history retained by the originating department); point-in-time snapshots + period comparison; three roles (Admin, Risk Officer, Risk Champion); a combined Dashboard (period filter, a monthly review panel covering every Open/In Progress risk regardless of when it was raised, merged analytics, monthly **and** weekly trends); a Departmental View; a single combined Enterprise View (department summary + a rollup by shared risk category); scoped CSV export; division-impact tagging (6 fixed divisions, Admin-editable on any risk).

**Out of scope:** any external system integration; automated email/push notifications (an in-app 30-day overdue indicator is in scope — FR-DASH-008); multi-tenant support; an in-app bulk-import tool (the business will manually seed the database from the spreadsheet before changeover).

---

## Roles and Permissions

Three roles — no others:

| Role | Description |
|---|---|
| **Admin** | Full system control: user accounts, departments, the shared risk category list, scoring configuration, and all data. |
| **Risk Officer** | Organisation-wide oversight: can view and manage risks across every department, owns the Enterprise View, triggers snapshots. |
| **Risk Champion** | Linked to one department; creates and maintains that department's risks and mitigation plans. |

No fourth, read-only ExCo/management role — they use a Risk Officer/Admin login or an exported report.

### Key rules

- Closing a risk is a normal edit action — the owning Risk Champion (or Risk Officer/Admin for any risk) can close it directly; no separate cross-role confirmation step.
- Risk Champions may archive (soft-delete) their own department's risks; Admin/Risk Officer can always see archived risks, including full history, regardless of department.
- When a risk is transferred, the originating department's Risk Champion keeps read-only access to it and its history; only the receiving department's Risk Champion (plus Admin/Risk Officer) can edit it going forward.
- Export is always scoped to what the exporting user can otherwise view.

---

## Functional Requirements

Acceptance criteria use Given/When/Then. Priority: Must / Should / Could.

### Authentication & Access (AUTH)

| ID | Title | The system shall... | Actor | Priority | Dependencies | Acceptance criteria |
|---|---|---|---|---|---|---|
| FR-AUTH-001 | Login | ...authenticate a user by email and password before granting access to any page. | All | Must | — | Given a valid email/password, when submitted, then a session is granted and the user is redirected to their role's landing page. Given an invalid password, then access is refused with a generic message. |
| FR-AUTH-002 | Role-based page access | ...restrict every page and API action to the roles permitted in the permission matrix, enforced on the server for every request. | All | Must | FR-AUTH-001 | Given a Risk Champion requests the Enterprise View page or endpoint directly, then access is refused regardless of request method. |
| FR-AUTH-003 | Department scoping | ...restrict a Risk Champion's create/edit/archive actions to their own department, enforced server-side. | Risk Champion | Must | FR-AUTH-002 | Given a Risk Champion in IT submits an edit for a Finance risk, then it is rejected and logged. |
| FR-AUTH-004 | Password change | ...allow a logged-in user to change their own password after confirming their current one. | All | Should | FR-AUTH-001 | Given correct current + new password, then it updates and the session persists. Given an incorrect current password, then rejected. Length/complexity rules are explicitly deferred (**[TBD]**, Open Items). |
| FR-AUTH-005 | Account administration | ...allow an Admin to create, deactivate, and reassign the role/department of a user account. | Admin | Must | FR-AUTH-002 | Given an Admin deactivates a user, then they can no longer log in even with correct credentials. |

### Risk Register (REG)

| ID | Title | The system shall... | Actor | Priority | Dependencies | Acceptance criteria |
|---|---|---|---|---|---|---|
| FR-REG-001 | Create risk | ...allow a Risk Champion to create a risk in their own department, capturing: title, description, category, impact (1–5), likelihood (1–5), mitigation plan, risk response (Accept/Mitigate/Transfer/Avoid), review date, division(s). | Risk Champion | Must | FR-AUTH-003 | Given all required fields, when submitted, then created as Open with identifiers per FR-REG-002. Given impact/likelihood blank, then saved with blank rating/level, flagged incomplete. |
| FR-REG-002 | Dual risk identifiers | ...assign every new risk a system UUID (internal, never user-facing) and an org ID `<DEPT-PREFIX>-<NN>` (zero-padded, sequential per department). Both immutable for the risk's life, including after transfer or archival; never reused or renumbered. | System | Must | FR-REG-001 | Given IT has IT-01…IT-05, a new risk gets IT-06. Given IT-03 is archived, the next new risk still gets the next unused number, not IT-03. Concurrent creates get distinct, non-colliding identifiers. |
| FR-REG-003 | Department prefixes | ...use: People=PPL, Finance=FIN, Legal=LEG, IT=IT, Projects=PRJ, HSSE=HSE, Commercial=COM, Supply Chain=SCM. | System | Must | FR-REG-002 | Given a risk under "People", its org ID begins "PPL-". |
| FR-REG-004 | Edit risk | ...allow editing of all fields — including division tags — by Admin/Risk Officer (any dept) or the owning Risk Champion (own dept). | Admin, Risk Officer, Risk Champion | Must | FR-REG-001, FR-HIST-001 | Given a Risk Champion edits their own risk, it saves and is recorded in history. Given an Admin edits division tags on any risk, accepted. Given a Risk Champion edits another dept's risk, refused. |
| FR-REG-005 | View risk register | ...display a filterable, sortable list scoped to the viewer (own dept + read-only transferred-out, for Risk Champion; all depts for Admin/Risk Officer), with both IDs, title, category, rating, level, status, Active/Inactive (BR-13), mitigation status — filterable by Active/Inactive among other fields. | All | Must | FR-AUTH-002, FR-REG-009, BR-13 | Given a Risk Champion views the register, only their dept's risks are editable; transferred-out risks show separately, read-only. Filtering to "Inactive" shows only Closed risks. |
| FR-REG-006 | Division-impact tagging | ...allow tagging, at creation or later, with any combination of: Development Management, Mechanical, Civil, Electrical, TLM, Corporate Services. | Risk Champion, Risk Officer, Admin | Must | FR-REG-001, FR-REG-004 | Given a risk tagged Civil + Electrical, both are recorded and filterable. |
| FR-REG-007 | Archive risk | ...allow a Risk Champion to archive their own dept's risk; Admin/Risk Officer can archive any risk. Archived risks are hidden from default views but fully visible, with history, to Admin/Risk Officer. | Risk Champion, Risk Officer, Admin | Must | FR-REG-004, FR-HIST-001 | Given a Risk Champion archives their own risk, it disappears from their active list and the action is logged. Given a Risk Officer views archived risks, they see it with full history. Given a Risk Champion archives another dept's risk, refused. |
| FR-REG-008 | Risk comments | ...allow any viewer to add a free-text, timestamped, attributed comment; once posted, never editable or deletable. | Admin, Risk Officer, Risk Champion | Must | FR-REG-001, FR-HIST-001 | Given a comment is added, it appears immediately and is logged in history. No edit/delete option is offered. |
| FR-REG-009 | Transfer risk to another department | ...allow Admin, Risk Officer, or the owning Risk Champion to change a risk's department. Org ID/UUID unchanged; originating department keeps read-only access + history; receiving department gains full edit rights; logged as a history entry. | Admin, Risk Officer, Risk Champion (own dept only) | Must | FR-REG-002, FR-HIST-001, FR-AUTH-003 | Given IT-04 is transferred IT→Legal (by any eligible actor, including an IT Risk Champion), IT sees it read-only with history; Legal can edit it; its ID stays "IT-04". Given a Risk Champion transfers another dept's risk, refused. |

### Scoring & Risk Distribution (SCORE)

| ID | Title | The system shall... | Actor | Priority | Dependencies | Acceptance criteria |
|---|---|---|---|---|---|---|
| FR-SCORE-001 | Compute rating | ...compute Rating = Impact × Likelihood server-side whenever both are numeric; never accept a manual Rating. | System | Must | FR-REG-001 | Impact=4, Likelihood=4 → Rating=16. Either blank → Rating blank, not zero. |
| FR-SCORE-002 | Compute risk level | ...classify Rating into Level per BR-01: Low (1–8), Medium (9–14), High (15–25). | System | Must | FR-SCORE-001 | Rating=14→Medium; 15→High; 8→Low. |
| FR-SCORE-003 | Risk distribution chart | ...display risk counts by Likelihood × Impact as a bar chart (not a colour-grid heat map), filterable by department/division. | Admin, Risk Officer, Risk Champion | Must | FR-SCORE-001, FR-AUTH-002 | Risk Champion sees only their dept's counts; Admin filtering by division "Civil" sees only matching risks. |
| FR-SCORE-004 | Consistent scoring everywhere | ...use the one Rating/Level computation on every screen that shows one. | System | Must | FR-SCORE-001, FR-SCORE-002 | A risk's Level is identical across Dashboard, Departmental View, and Enterprise View. |

### Mitigation Plans & Monthly Review (MIT)

| ID | Title | The system shall... | Actor | Priority | Dependencies | Acceptance criteria |
|---|---|---|---|---|---|---|
| FR-MIT-001 | Structured mitigation plan | ...capture per risk: description, owner, due date, status (Not Started/In Progress/Done). | Risk Champion | Must | FR-REG-001 | All four fields shown after saving. |
| FR-MIT-002 | Mark mitigation done | ...allow the owning Risk Champion (or Admin/Risk Officer) to set status to Done. | Risk Champion, Risk Officer, Admin | Must | FR-MIT-001 | Status updates, timestamped and attributed. |
| FR-MIT-003 | Monthly review panel | ...show, on the Dashboard, every risk currently Open or In Progress — regardless of when created — with its mitigation plan. A risk stays on the list until closed. | Risk Officer, Admin, Risk Champion | Must | FR-MIT-001, FR-DASH-001 | Risks opened in August, September, and October that are still open all appear together, not just October's. |
| FR-MIT-004 | Close a risk | ...allow the owning Risk Champion, or Admin/Risk Officer for any risk, to set status to Closed — typically once mitigation is Done, with no separate cross-role confirmation. | Risk Champion, Risk Officer, Admin | Must | FR-MIT-002 | Owning Risk Champion closes their risk directly. A Risk Champion closing another dept's risk is refused. |
| FR-MIT-005 | Highest-rated risks with mitigation | ...list, on the Departmental View, all open High-rated risks (uncapped) with their mitigation plans. | Risk Champion, Risk Officer, Admin | Must | FR-SCORE-002, FR-MIT-001 | 4 open High + 6 Medium risks → all 4 High shown with plans; no Medium included. |

### Field-Level Audit History (HIST)

| ID | Title | The system shall... | Actor | Priority | Dependencies | Acceptance criteria |
|---|---|---|---|---|---|---|
| FR-HIST-001 | Record field changes | ...record an immutable, attributed, timestamped entry (old/new value) for every field change — at minimum title, description, category, impact, likelihood, risk response, status, mitigation plan fields, division tags, owning department — and for every comment added. | System | Must | FR-REG-001 | 3 fields changed in one save → 3 history entries. Comment added → logged. Unchanged value on save → no entry. |
| FR-HIST-002 | View risk history | ...show a risk's full chronological history, paginated, to any permitted viewer. | Admin, Risk Officer, Risk Champion | Must | FR-HIST-001, FR-AUTH-002 | 35 entries → all pageable, not just the most recent. |
| FR-HIST-003 | Attribute system actions | ...attribute automated changes (e.g. overdue flag) to "System," distinct from user changes. | System | Should | FR-HIST-001 | Auto-flag entry shows "System" as actor. |

### Snapshots & Period Comparison (SNAP)

| ID | Title | The system shall... | Actor | Priority | Dependencies | Acceptance criteria |
|---|---|---|---|---|---|---|
| FR-SNAP-001 | Take a snapshot | ...allow Admin/Risk Officer to capture an immutable, point-in-time copy of the register, labelled by period. | Admin, Risk Officer | Must | FR-REG-001 | Snapshot for "2026-10" reflects that moment's state regardless of later edits. |
| FR-SNAP-002 | Prevent duplicate snapshot | ...block a second snapshot for a period already taken, offering view/replace instead. | System | Must | FR-SNAP-001 | Second attempt for the same period warns and requires explicit confirm. |
| FR-SNAP-003 | Compare two snapshots | ...compare any two snapshots (or one vs. the live register): rating/status delta, New/Removed flags. | Admin, Risk Officer, Risk Champion (own dept) | Must | FR-SNAP-001 | IT-04 in Sept only → "Removed". IT-09 in Oct only → "New". |
| FR-SNAP-004 | Master register, filtered by period | ...let any user filter the live register by month/year without physically duplicating rows, sorted alphabetically by department. | Admin, Risk Officer, Risk Champion | Must | FR-REG-005, FR-SNAP-001 | Selecting "October 2026" shows only risks open/created on/before that period. |

### Dashboard (DASH)

| ID | Title | The system shall... | Actor | Priority | Dependencies | Acceptance criteria |
|---|---|---|---|---|---|---|
| FR-DASH-001 | Period filter | ...provide a month/year filter scoping every Dashboard widget. | All | Must | FR-SNAP-004 | Selecting a period updates stat cards, charts, and the review panel together. |
| FR-DASH-002 | Monthly review panel | ...include the FR-MIT-003 panel by default. | Risk Officer, Admin, Risk Champion | Must | FR-MIT-003 | See FR-MIT-003. |
| FR-DASH-003 | Merged analytics | ...present, on the Dashboard (no separate Analytics page), all chart types: risk level distribution, by department, average rating by risk category, top-rated, response strategy, review completion — all as bar charts. | Risk Officer, Admin | Must | FR-SCORE-002 | No "Analytics" nav item exists; same content, including average rating per category, lives on the Dashboard. |
| FR-DASH-004 | Monthly rating trend | ...show a trend of average risk rating by month, computed from monthly snapshots (FR-SNAP-001) — not live/history data. Selectable by scope: organisation-wide, a single risk category, or an individual risk. | Risk Officer, Admin (org/category); Risk Champion (individual risk, own dept) | Must | FR-SNAP-001, FR-ADMIN-002 | 6 months of snapshots → 6 monthly data points. Selecting a category shows only that category's average. Selecting a risk shows its own rating per snapshot. A month with no snapshot shows as a gap. |
| FR-DASH-005 | Weekly trend view | ...show a weekly-aggregated trend alongside the monthly one, from the same continuously-tracked state. | Risk Officer, Admin | Must | FR-HIST-001 | 8 weeks of data → 8 weekly points, independent of snapshot cadence. |
| FR-DASH-006 | Role-scoped dashboard | ...scope every widget to the viewer's permitted data. | All | Must | FR-AUTH-002 | Risk Champion's Dashboard reflects only their department. |
| FR-DASH-007 | Risk-level stat cards | ...show Low/Medium/High counts per BR-01. | All | Must | FR-SCORE-002 | 3 High + 5 Medium + 2 Low → all shown, summing to the total. |
| FR-DASH-008 | Overdue review indicator | ...flag a risk "overdue for review" when >30 days since its last review — "last reviewed" being the timestamp of its most recent comment (BR-12), or its creation date if it has none. | System | Should | FR-REG-008, BR-12 | Most recent comment 31 days ago → flagged. 29 days ago → not. Never commented and created 31+ days ago → also flagged. |

### Departmental View (DEPT)

| ID | Title | The system shall... | Actor | Priority | Dependencies | Acceptance criteria |
|---|---|---|---|---|---|---|
| FR-DEPT-001 | Departmental risk distribution chart | ...apply FR-SCORE-003 scoped to one department. | Risk Champion, Risk Officer, Admin | Must | FR-SCORE-003, FR-SCORE-004 | Finance's chart shows only Finance's risks, with BR-01 bands. |
| FR-DEPT-002 | Departmental report: highest-rated risks | ...include the FR-MIT-005 section. | Risk Champion, Risk Officer, Admin | Must | FR-MIT-005 | See FR-MIT-005. |
| FR-DEPT-003 | Departmental ratings trend | ...show the department's trend in both monthly and weekly views. | Risk Champion, Risk Officer, Admin | Must | FR-DASH-004, FR-DASH-005 | 6 months of data → 6 points in monthly mode; switching to weekly shows weekly granularity. |
| FR-DEPT-004 | Direct link to a department's own view | ...link into a department's Departmental View directly from both the Dashboard ("My Department," for a Risk Champion) and the Risk Register (a department picker, for Admin/Risk Officer) — not only via the Enterprise View. | All | Must | FR-DEPT-001, FR-DASH-001, FR-REG-005 | A Risk Champion on the Dashboard or Risk Register clicks "My Department" and lands directly on their own Departmental View. An Admin on the Risk Register can jump to any department's view without going through the Enterprise View first. |

### Enterprise View (ENT)

| ID | Title | The system shall... | Actor | Priority | Dependencies | Acceptance criteria |
|---|---|---|---|---|---|---|
| FR-ENT-001 | Combined enterprise view | ...show, on one screen, (a) per-department risk summary and (b) a rollup of average risk rating per risk category. | Admin, Risk Officer | Must | FR-SCORE-004, FR-REG-005 | Both sections visible on one screen, no navigation needed. |
| FR-ENT-002 | Mitigation plans in Enterprise View | ...show a risk's mitigation plan when drilled into from either section. | Admin, Risk Officer | Must | FR-ENT-001, FR-MIT-001 | Expanding a High-rated risk shows its full mitigation plan. |
| FR-ENT-003 | Category rollup | ...compute, for the Enterprise View, an average risk rating per risk category by aggregating all risks that share that category directly — no separate taxonomy or mapping layer — recalculated live as underlying risks change. | System | Must | FR-SCORE-001, FR-ADMIN-002 | Given two risks in different departments share the category "Operational," when the Enterprise View is computed, then both contribute to the "Operational" rollup average. Given a risk's category is changed, when the Enterprise View is next viewed, then the rollup reflects the change immediately. |

### Administration (ADMIN)

| ID | Title | The system shall... | Actor | Priority | Dependencies | Acceptance criteria |
|---|---|---|---|---|---|---|
| FR-ADMIN-001 | Manage departments | ...allow Admin to add/edit a department and its prefix. | Admin | Should | FR-AUTH-005 | New dept "Marketing"/"MKT" → risks generate as MKT-01, etc. |
| FR-ADMIN-002 | Manage risk categories | ...allow Admin to add/edit the single, shared list of risk categories available to every department. | Admin | Should | FR-AUTH-005 | New category "Cyber Resilience" is selectable by any department's Risk Champion. |
| FR-ADMIN-004 | Manage divisions | ...allow Admin to add/edit the fixed division list. | Admin | Could | FR-REG-006 | New division becomes selectable immediately. |

### Reports & Export (RPT)

| ID | Title | The system shall... | Actor | Priority | Dependencies | Acceptance criteria |
|---|---|---|---|---|---|---|
| FR-RPT-001 | Export to CSV | ...export the current filtered list, scoped to the exporter's visible data. | All | Should | FR-REG-005, FR-AUTH-002 | Risk Champion export → own dept only. Admin filtered export → that filter only. |
| FR-RPT-002 | Printable department/enterprise report | ...generate a printable report mirroring Departmental/Enterprise View content, scoped by role. | Risk Officer, Admin, Risk Champion | Could | FR-DEPT-001, FR-ENT-001 | Risk Champion's report contains only their department. |

---

## Business Rules

| ID | Rule | Affects |
|---|---|---|
| BR-01 | Rating = Impact × Likelihood (1–5 each). Level: Low (1–8), Medium (9–14), High (15–25). | FR-SCORE-001/002/004 |
| BR-02 | A risk carries two immutable identifiers for life: a system UUID and a department-prefixed, sequential, zero-padded org ID. Never reused/renumbered, even after archival or transfer. | FR-REG-002, FR-REG-009 |
| BR-03 | Department prefixes: People=PPL, Finance=FIN, Legal=LEG, IT=IT, Projects=PRJ, HSSE=HSE, Commercial=COM, Supply Chain=SCM. | FR-REG-002/003 |
| BR-04 | A risk may be set to Closed by the owning Risk Champion, or Admin/Risk Officer for any risk, as a normal edit — no separate cross-role confirmation. | FR-MIT-004 |
| BR-05 | A risk may be tagged against any combination of 6 fixed divisions: Development Management, Mechanical, Civil, Electrical, TLM, Corporate Services. | FR-REG-006 |
| BR-06 | Every field change (including mitigation plan) and every comment produces an immutable, attributed, timestamped history entry. | FR-HIST-001, FR-REG-008 |
| BR-07 | A snapshot, once taken, is immutable; at most one per period (month). | FR-SNAP-001/002 |
| BR-08 | Admin, Risk Officer, or the owning Risk Champion may archive a risk; Admin/Risk Officer can always view archived risks (with full history) regardless of department. | FR-REG-007 |
| BR-09 | Risk categories come from a single, shared, organisation-wide list — not department-specific; every department's risks are categorized from this same list, and it is also what the Enterprise View rollup groups by directly. | FR-ADMIN-002, FR-ENT-003 |
| BR-10 | Export is always limited to what the exporting user's role/department scope permits them to view. | FR-RPT-001 |
| BR-12 | A risk is reviewed for a month if a comment is added to it that month. "Last reviewed" = the most recent comment's timestamp (or creation date, if none) — no separate manual "mark reviewed" step. | FR-DASH-008, FR-REG-008 |
| BR-13 | A risk is Active when its status is Open or In Progress, and Inactive once Closed — independent of archival. | FR-REG-005 |

---

## Non-Functional Requirements

| ID | Statement | Priority |
|---|---|---|
| NFR-SEC-01 | No database credentials/secrets in plaintext source code; use environment variables or a secrets manager. | Must |
| NFR-SEC-02 | Every state-changing API endpoint independently verifies caller role + department scope server-side. | Must |
| NFR-SEC-03 | Refresh tokens expire 1 day after issuance. Password length/complexity policy is explicitly deferred (**[TBD]**, Open Items). | Must |
| NFR-DATAINT-01 | Rating/Level computed by one shared server-side function; never entered manually or duplicated client-side. | Must |
| NFR-AUDIT-01 | Every create/update/archive/transfer/comment action produces a history entry (actor, timestamp, field, old/new value). | Must |
| NFR-PERF-01 | Page load under 2 seconds at ≥1,000 risks and ≥50 concurrent users. | Should |
| NFR-AVAIL-01 | Best-effort availability during business hours; no formal SLA for v1. | Should |
| NFR-SCALE-01 | Data model supports ≥50 departments and ≥10,000 risks without redesign. | Should |
| NFR-USAB-01 | No formal usability target for v1; gather feedback post-launch. | Could |
| NFR-COMPAT-01 | Latest two versions of Chrome, Edge, Firefox; desktop-first. | Should |
| NFR-BACKUP-01 | Daily backups, 30-day rolling retention; all entities otherwise retained indefinitely. | Must |
| NFR-PRIVACY-01 | Personal-data access limited to the permission matrix; no data beyond name/email/department/role collected. | Must |
| NFR-MAINT-01 | Stack: TypeScript (both tiers), React, PostgreSQL + Knex, Better Auth. | Must |
| NFR-MONITOR-01 | Monitored via Uptime Kuma (availability) + Prometheus/Grafana (metrics), alerting to Discord/MS Teams. | Should |

---

## Data Requirements

Entities and attributes below are **proposed** — a conceptual model for the build team to work from, not a final schema.

| Proposed entity | Proposed attributes |
|---|---|
| **User** | name, email, password (hashed), role, department (Risk Champion only), active flag, refresh-token expiry (1 day) |
| **Department** | name, prefix |
| **RiskCategory** | name |
| **Division** | name |
| **Risk** | system UUID, org ID, current + originating department, category, title, description, impact, likelihood, rating (derived), level (derived), risk response, status, active flag (derived from status, BR-13), last-reviewed date (derived: latest comment timestamp or creation date, BR-12), archived flag |
| **RiskDivision** | risk, division |
| **MitigationPlan** | description, owner, due date, status |
| **Comment** | author, body, timestamp |
| **HistoryEntry** | risk, actor (user or "System"), field, old value, new value, action type, timestamp |
| **Snapshot** | period, taken by, taken at |
| **SnapshotRisk** | snapshot, risk org ID, department, category, rating, level, status, mitigation status |

Detailed logical/physical schema (types, indexes, constraints) is left to migration scripts.

---

## Proposed Screens

No mock-ups — purpose and behavior only.

| ID | Screen | Users | Purpose | Linked FRs |
|---|---|---|---|---|
| SCR-01 | Login | Everyone | Authenticate. | FR-AUTH-001 |
| SCR-02 | Dashboard | All (scoped) | Role-scoped overview: period filter, monthly review list (every Open/In Progress risk), merged analytics, monthly/weekly trends. | FR-DASH-001…008, FR-MIT-002…004 |
| SCR-03 | Risk Register (list) | All (scoped) | Browse/filter/sort risks; entry point to every per-risk action. | FR-REG-001,004,005,007,009; FR-SNAP-004 |
| SCR-04 | Create / Edit Risk | Risk Champion, Risk Officer, Admin | Capture/update a risk's full field set, mitigation plan, division tags. | FR-REG-001,004,006; FR-MIT-001 |
| SCR-05 | Risk Detail | All (per permission) | Full risk view: fields, mitigation plan, comments, history link. | FR-REG-004,006,008,009; FR-MIT-001,002,004 |
| SCR-06 | Risk History | All (per permission) | Paginated change log + comments for one risk. | FR-HIST-001,002,003; FR-REG-008 |
| SCR-07 | Risk Distribution Chart | All (scoped) | Bar-chart visualization of Likelihood × Impact. | FR-SCORE-003 |
| SCR-08 | Departmental View | Risk Champion (own), Risk Officer/Admin (any) | Department-focused — effectively that department's own dashboard: distribution chart, highest-rated risks + mitigation, ratings trend. Reachable directly from the Dashboard and Risk Register, not only via the Enterprise View. | FR-DEPT-001,002,003,004 |
| SCR-09 | Enterprise View | Admin, Risk Officer | Combined department summary + a rollup by risk category, with drill-down. | FR-ENT-001,002,003 |
| SCR-10 | Snapshot & Compare | Admin/Risk Officer (trigger); all (compare, scoped) | Take a snapshot; compare two periods or a period vs. live. | FR-SNAP-001…004 |
| SCR-11 | Archived Risks | Admin, Risk Officer | Review archived risks with full history. | FR-REG-007 |
| SCR-12 | Admin Console | Admin | Manage departments, the shared risk category list, divisions, users. | FR-ADMIN-001, 002, 004; FR-AUTH-005 |
| SCR-13 | Export / Report | All (scoped) | CSV export or printable report. | FR-RPT-001,002 |
| SCR-14 | Profile / Password Change | All | Self-service password change. | FR-AUTH-004 |

**UX principles:** bar charts everywhere a risk-distribution visualization is needed (not heat-map grids); the Dashboard's period filter scopes every widget on the page; navigation shows only screens a role can access; archived risks need an explicit action to view; a transferred-out risk is visually distinguished as read-only in the Risk Register.

---

## Glossary

| Term | Definition |
|---|---|
| Risk | A single logged risk record, identified by a system UUID and a human-facing org ID. |
| Org ID | e.g. `IT-01` — department prefix + sequential number, immutable for the risk's life. |
| Rating | Impact × Likelihood (1–25). |
| Level | Low/Medium/High classification of Rating, per BR-01. |
| Risk Response | Accept, Mitigate, Transfer, or Avoid. |
| Mitigation Plan | description, owner, due date, status. |
| Division | One of 6 fixed org units a risk may affect (distinct from "Department," which owns the risk). |
| Risk Category | A single, shared, organisation-wide category used to classify a risk — not department-specific — and what the Enterprise View rollup groups by. |
| Snapshot | Immutable, point-in-time copy of the register for one month. |
| Archive | Reversible removal from active views (not a permanent delete). |
| Transfer | Reassignment of a risk's department; identifiers and history persist. |

---

## Open Items

- **Password length/complexity policy** — explicitly left undefined by the business (not an oversight). Implement using the auth framework's own default for v1; revisit if a specific policy is requested.
- **Snapshot-taking is still manual-only, but the monthly rating trend (FR-DASH-004) now depends on a snapshot existing every month.** A missed manual snapshot leaves a visible gap in the trend. Keep manual for v1 unless the business wants it automated.

For the decision history, business objectives, release plan, risks/assumptions, and sign-off checklist, see `SRS.md`.
