"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { Alert } from "@/components/auth/auth-ui";
import { monthLabel } from "@/components/risk-register/filter-menus";
import { Skeleton } from "@/components/risk-detail/ui";
import { Dropdown } from "@/components/ui/dropdown";
import { useReportMonths } from "@/hooks/queries/use-reports";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ReportsPage() {
  const months = useReportMonths();
  const years = [...new Set((months.data ?? []).map((m) => m.month.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
  const [picked, setYear] = useState("");
  const year = picked || years[0] || "";
  const available = new Map((months.data ?? []).map((m) => [m.month, m.total]));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.96px]">Reports</h1>
        {/* <p className="max-w-[640px] text-[15px] leading-[1.6] text-ink-muted">
          A report for every month on record, for audit and compliance. Pick a month to read its report. For the detail behind it, open the app with that period selected.
        </p> */}
      </header>

      {months.isError ? (
        <div className="flex flex-col items-start gap-3">
          <Alert variant="error" title="Could not load the reports">{months.error.message}</Alert>
          <button type="button" className="btn-secondary btn-auto" onClick={() => months.refetch()}>Try again</button>
        </div>
      ) : !months.data ? (
        <div aria-busy="true" aria-label="Loading reports" className="flex flex-col gap-4"><Skeleton className="h-9 w-32" /><Skeleton className="h-[260px] rounded-2xl" /></div>
      ) : months.data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <FileText className="size-8 text-ink-muted" strokeWidth={1.5} aria-hidden />
          <p className="text-[15px] font-medium">No reports yet</p>
          <p className="text-[14px] text-ink-muted">Reports appear once risks have been logged.</p>
        </div>
      ) : (
        <>
          <div>
            <Dropdown
              label="Year:"
              selectedId={year}
              items={years.map((y) => ({ id: y, name: y }))}
              onSelect={setYear}
            />
          </div>
          <div key={year} className="animate-fade-up grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {MONTHS.map((name, i) => {
              const key = `${year}-${String(i + 1).padStart(2, "0")}`;
              const total = available.get(key);
              const tile = "flex min-h-[96px] flex-col justify-between border p-4";
              return total === undefined ? (
                <div key={key} aria-disabled className={cn(tile, "border-line bg-transparent opacity-40")}>
                  <span className="text-[15px] font-medium">{name}</span>
                  <span className="text-[13px] text-ink-muted">No report</span>
                </div>
              ) : (
                <Link key={key} href={`/reports/${key}`} className={cn(tile, "group border-line bg-surface transition-[transform,border-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]  hover:border-b-2 hover:border-b-brand")}>
                  <span className="text-[15px] font-semibold group-hover:text-brand">{monthLabel(key)}</span>
                  <span className="text-[13px] text-ink-muted">{total} {total === 1 ? "risk" : "risks"} on record</span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
