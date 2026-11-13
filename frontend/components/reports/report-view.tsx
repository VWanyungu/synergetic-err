import { Card } from "@/components/dashboard/card";
import type { BreakdownRow, DashboardData } from "@/lib/dashboard";
import { LEVEL_TEXT, riskLevel } from "@/lib/risk";
import { cn } from "@/lib/utils";

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
const HEAD = "text-[11px] font-medium uppercase leading-[1.3] tracking-[0.66px] text-ink-muted";
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).replace("Sept", "Sep") : "Never");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[18px] font-semibold leading-[1.3] tracking-[-0.27px]">{title}</h2>
      {children}
    </section>
  );
}

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="overflow-hidden rounded-xl border border-line">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[200px_1fr] border-b border-line last:border-b-0">
          <dt className="bg-brand-bg px-4 py-3 text-[14px] font-medium text-brand-text-muted">{k}</dt>
          <dd className="px-4 py-3 text-[14px] font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Breakdown({ name, rows }: { name: string; rows: BreakdownRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className={cn(HEAD, "grid grid-cols-[1fr_72px_72px_72px_72px] gap-2 bg-subtle px-4 py-3")}>
        <span>{name}</span>
        <span className="text-center">High</span>
        <span className="text-center">Medium</span>
        <span className="text-center">Low</span>
        <span className="text-center">Total</span>
      </div>
      {rows.map((r) => (
        <div key={r.id} className="grid grid-cols-[1fr_72px_72px_72px_72px] items-center gap-2 border-t border-line px-4 py-2.5 text-[14px]">
          <span className="truncate">{r.name}</span>
          <span className={cn("text-center", r.high ? "text-danger-fg" : "text-ink-muted")}>{r.high}</span>
          <span className="text-center">{r.medium}</span>
          <span className="text-center">{r.low}</span>
          <span className="text-center font-semibold">{r.total}</span>
        </div>
      ))}
    </div>
  );
}

/** A month's report on screen: the same figures and order as the PDF. */
export function ReportView({ data, period }: { data: DashboardData; period: string }) {
  const { levels, review, coverage, breakdown, top } = data;
  const tiles = [
    { label: "Total risks", value: levels.total, cls: "" },
    { label: "High", value: levels.high, cls: "text-danger-fg" },
    { label: "Medium", value: levels.medium, cls: "text-warning-fg" },
    { label: "Low", value: levels.low, cls: "text-success-fg" },
  ];
  return (
    <div className="flex flex-col gap-10">
      <Section title="1.0  Risk summary">
        {/* <p className="max-w-[720px] text-[14px] leading-[1.6] text-ink-muted">
          The risk register as at {period}. Ratings are impact × likelihood, banded High (15 to 25), Medium (9 to 14) and Low (1 to 8).
        </p> */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {tiles.map((t) => (
            <Card key={t.label} coreClassName="gap-2 px-5 py-4">
              <p className={HEAD}>{t.label}</p>
              <p className={cn("text-[32px] font-semibold leading-none tracking-[-0.96px]", t.cls)}>{t.value}</p>
              {t.label !== "Total risks" && <p className="text-[13px] text-ink-muted">{pct(t.value, levels.total)}% of total</p>}
            </Card>
          ))}
        </div>
      </Section>

      <Section title="1.1  Review compliance">
        <Facts rows={[[`Reviewed in ${period}`, `${review.reviewed} of ${review.total} risks (${pct(review.reviewed, review.total)}%)`], ["Pending review", `${review.pending} ${review.pending === 1 ? "risk" : "risks"}`]]} />
      </Section>

      <Section title="1.2  Mitigation coverage">
        <Facts rows={[["With a mitigation plan", `${coverage.withPlan} of ${coverage.total} risks (${pct(coverage.withPlan, coverage.total)}%)`], ["No mitigation plan", `${coverage.noPlan} ${coverage.noPlan === 1 ? "risk" : "risks"}`]]} />
      </Section>

      <Section title="2.0  Risk breakdown">
        {!data.scoped && <Breakdown name="Department" rows={breakdown.department} />}
        <Breakdown name="Category" rows={breakdown.category} />
        <Breakdown name="Division" rows={breakdown.division} />
      </Section>

      <Section title="3.0  Highest rated risks">
        {top.length === 0 ? (
          <p className="text-[14px] text-ink-muted">There are no risks to show for this period.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <div className="min-w-[760px]">
              <div className={cn(HEAD, "grid grid-cols-[70px_minmax(0,1fr)_150px_70px_140px_90px_110px] gap-3 bg-subtle px-4 py-3")}>
                <span>ID</span><span>Risk</span><span>Department</span><span className="text-center">Rating</span><span>Owner</span><span>Status</span><span>Last review</span>
              </div>
              {top.map((r) => (
                <div key={r.id} className="grid grid-cols-[70px_minmax(0,1fr)_150px_70px_140px_90px_110px] items-center gap-3 border-t border-line px-4 py-3 text-[14px]">
                  <span className="font-mono text-[13px]">{r.code}</span>
                  <span className="font-medium">{r.title}</span>
                  <span>{r.department}</span>
                  <span className={cn("text-center font-semibold", LEVEL_TEXT[riskLevel(r.rating)])}>{r.rating}</span>
                  <span>{r.owner ?? "Unassigned"}</span>
                  <span>{r.archivedAt ? "Archived" : r.status === "closed" ? "Inactive" : "Active"}</span>
                  <span className="text-ink-muted">{fmt(r.lastReviewedAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
