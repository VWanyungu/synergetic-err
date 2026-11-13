"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight, ChevronsUpDown } from "lucide-react";
import { Alert } from "@/components/auth/auth-ui";
import { ReportButton } from "@/components/dashboard/report-button";
import { DateMenu, monthLabel } from "@/components/risk-register/filter-menus";
import { Skeleton } from "@/components/risk-detail/ui";
import { ReportView } from "@/components/reports/report-view";
import { usePeriod } from "@/contexts/period-context";
import { useDashboard } from "@/hooks/queries/use-dashboard";
import { useMe } from "@/hooks/queries/use-me";
import { DEFAULT_FILTERS } from "@/hooks/queries/use-risk-register";
import { useOutsideClick } from "@/hooks/use-outside-click";

// The report takes no table filters: it is the month as it stands, every status, highest rated first.
const REPORT_TABLE = { ...DEFAULT_FILTERS, sort: "rating_desc", status: [] };

export default function ReportPage() {
  const { month } = useParams<{ month: string }>();
  const router = useRouter();
  const { setMonth } = usePeriod();
  const me = useMe();
  const [open, setOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  useOutsideClick(switcherRef, () => setOpen(false));

  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  const report = useDashboard(valid ? month : "", "", REPORT_TABLE);
  const period = valid ? monthLabel(month) : "";

  if (!valid)
    return (
      <div className="flex flex-col items-start gap-3">
        <Alert variant="error" title="That is not a report month">Choose a month from the list of reports.</Alert>
        <Link href="/reports" className="btn-primary btn-auto">All reports</Link>
      </div>
    );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[14px] leading-normal">
          <Link href="/reports" className="text-brand hover:underline">Reports</Link>
          <ChevronRight className="size-3 text-ink-muted" aria-hidden />
          <div ref={switcherRef} className="relative flex items-center" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
            <button
              type="button"
              aria-label="Switch period"
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
              className="group flex cursor-pointer items-center gap-1 rounded text-ink-muted hover:text-ink"
            >
              <span className="text-ink-muted group-hover:text-ink">{period}</span>
              <span className="flex size-5 items-center justify-center">
                <ChevronsUpDown className="size-3.5" aria-hidden />
              </span>
            </button>
            {open && (
              <DateMenu
                align="left"
                month={month}
                onApply={(m) => {
                  setOpen(false);
                  if (m && m !== month) router.push(`/reports/${m}`);
                  else if (!m) router.push("/reports");
                }}
              />
            )}
          </div>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.96px]">Risk Report, {period}</h1>
            <p className="text-[15px] leading-[1.6] text-ink-muted">{report.data ? (report.data.departmentId ? (report.data.departments.find((d) => d.id === report.data.departmentId)?.name ?? "Department") : "All departments") : " "}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* The detail lives in the app: open it with this report's period already selected. */}
            {/* <button type="button" onClick={() => { setMonth(month); router.push("/"); }} className="flex h-[34px] cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border border-line-input bg-surface px-4 text-[13px] font-medium transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-field active:scale-[0.98]">
              Open in the app
            </button> */}
            {report.data && <ReportButton data={report.data} preparedBy={me.data ? `${me.data.firstName} ${me.data.lastName}`.trim() : ""} />}
          </div>
        </div>
      </header>

      {report.isError ? (
        <div className="flex flex-col items-start gap-3">
          <Alert variant="error" title="Could not load this report">{report.error.message}</Alert>
          <button type="button" className="btn-secondary btn-auto" onClick={() => report.refetch()}>Try again</button>
        </div>
      ) : !report.data ? (
        <div aria-busy="true" aria-label="Loading report" className="flex flex-col gap-4"><Skeleton className="h-[120px] rounded-xl" /><Skeleton className="h-[200px] rounded-xl" /><Skeleton className="h-[260px] rounded-xl" /></div>
      ) : (
        <ReportView data={report.data} period={period} />
      )}
    </div>
  );
}
