import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, OVERLINE } from "@/components/dashboard/card";
import type { DashboardData } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

function StatusCard({
  title,
  href,
  hero,
  caption,
  stats,
}: {
  title: string;
  href: string;
  hero: string;
  caption: string;
  stats: { label: string; value: number; dot: string }[];
}) {
  const sum = stats.reduce((n, s) => n + s.value, 0);
  return (
    <Card className="min-w-0 flex-1" coreClassName="gap-5">
      <p className={OVERLINE}>{title}</p>
      <div className="flex items-center gap-6">
        <div className="flex w-[136px] shrink-0 flex-col gap-1">
          <p className="text-[44px] font-semibold leading-none tracking-[-1.32px]">{hero}</p>
          <p className="text-[13px] leading-normal text-ink-muted">{caption}</p>
        </div>
        <span className="h-14 w-px shrink-0 bg-line" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex gap-10">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col gap-1">
                <span className="flex items-center gap-1.5 text-[13px] leading-normal text-ink-muted">
                  <span className={cn("size-2 rounded-full", s.dot)} aria-hidden />
                  {s.label}
                </span>
                <span className="text-[20px] font-semibold leading-[1.3] tracking-[-0.3px]">{s.value}</span>
              </div>
            ))}
          </div>
          <div className="flex h-2 gap-0.5" role="img" aria-label={stats.map((s) => `${s.label} ${s.value}`).join(", ")}>
            {sum === 0 ? <span className="h-full flex-1 rounded-full bg-line-input" /> : stats.map((s) => (s.value ? <span key={s.label} className={cn("h-full rounded-full", s.dot)} style={{ flexGrow: s.value, flexBasis: 0 }} /> : null))}
          </div>
        </div>
        <Link href={href} aria-label={`Open ${title}`} className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-subtle hover:bg-field">
          <ChevronRight className="size-2.5" aria-hidden />
        </Link>
      </div>
    </Card>
  );
}

export function StatusCards({ data }: { data: DashboardData }) {
  const { review, coverage } = data;
  // Each card opens the register behind it, for the department being viewed, with its filter already on.
  const register = `/risks/register/${data.departmentId || "all"}`;
  const n = (c: number) => `of ${c} ${c === 1 ? "risk" : "risks"}`;
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <StatusCard
        title="Review compliance"
        href={`${register}?status=all&review=reviewed`}
        hero={`${pct(review.reviewed, review.total)}%`}
        caption={`${n(review.total)} reviewed`}
        stats={[
          { label: "Reviewed", value: review.reviewed, dot: "bg-ink" },
          { label: "Pending", value: review.pending, dot: "bg-line-input" },
        ]}
      />
      <StatusCard
        title="Mitigation coverage"
        href={`${register}?status=all&quick=noMitigation`}
        hero={`${pct(coverage.withPlan, coverage.total)}%`}
        caption={`${n(coverage.total)} covered`}
        stats={[
          { label: "With plan", value: coverage.withPlan, dot: "bg-ink" },
          { label: "No plan", value: coverage.noPlan, dot: "bg-line-input" },
        ]}
      />
    </div>
  );
}
