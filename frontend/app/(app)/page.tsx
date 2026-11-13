"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Smile } from "lucide-react";
import { Alert } from "@/components/auth/auth-ui";
import { BreakdownCard } from "@/components/dashboard/breakdown-card";
import { Card } from "@/components/dashboard/card";
import { LevelFlow } from "@/components/dashboard/level-flow";
import { StatusCards } from "@/components/dashboard/status-cards";
import { RiskTable } from "@/components/risk-register/risk-table";
import { ReportButton } from "@/components/dashboard/report-button";
import { useMe } from "@/hooks/queries/use-me";
import { currentMonth, DateFilter, monthLabel } from "@/components/risk-register/filter-menus";
import { Dropdown } from "@/components/ui/dropdown";
import { DEFAULT_FILTERS, type RegisterFilters } from "@/hooks/queries/use-risk-register";
import { usePeriod } from "@/contexts/period-context";
import { useDashboard } from "@/hooks/queries/use-dashboard";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="flex flex-col gap-6">
      <div className="h-[168px] animate-pulse rounded-xl bg-field" />
      <div className="h-[429px] animate-pulse rounded-xl bg-field" />
      <div className="h-[420px] animate-pulse rounded-xl bg-field" />
    </div>
  );
}

export default function DashboardPage() {
  // Empty month means "this month"; empty department means all of them.
  const { month, setMonth } = usePeriod();
  const [departmentId, setDepartmentId] = useState("");
  const [table, setTable] = useState<RegisterFilters>({ ...DEFAULT_FILTERS, sort: "rating_desc", status: [] });
  const dashboard = useDashboard(month, departmentId, table);
  const me = useMe();
  const data = dashboard.data;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-3 text-[32px] font-semibold leading-[1.15] tracking-[-0.96px]">
          {greeting()}, {data?.firstName}
          <Smile className="size-8 shrink-0" strokeWidth={1.5} aria-hidden />
        </h1>
        <div className="flex items-center gap-2">
          <Dropdown
            label="Department:"
            align="right"
            selectedId={data?.scoped ? (data.departments[0]?.id ?? "") : departmentId}
            items={data?.scoped ? data.departments : [{ id: "", name: "All departments" }, ...(data?.departments ?? [])]}
            onSelect={setDepartmentId}
          />
          <DateFilter label="Period" empty={monthLabel(currentMonth())} month={month} onApply={setMonth} />
          {data && <ReportButton data={data} preparedBy={me.data ? `${me.data.firstName} ${me.data.lastName}`.trim() : ""} />}
        </div>
      </header>

      {dashboard.isError ? (
        <div className="flex flex-col items-start gap-3">
          <Alert variant="error" title="Could not load the dashboard">{dashboard.error.message}</Alert>
          <button type="button" className="btn-secondary btn-auto" onClick={() => dashboard.refetch()}>Try again</button>
        </div>
      ) : !data ? (
        <Skeleton />
      ) : data.levels.total === 0 ? (
        <p className="py-24 text-center text-[14px] text-ink-muted">No risks to show for this period.</p>
      ) : (
        <>
          <StatusCards data={data} />
          <div className="grid gap-6 lg:grid-cols-[796fr_420fr]">
            <BreakdownCard data={data.breakdown} categoryOnly={data.scoped} departmentId={data.departmentId} />
            <LevelFlow levels={data.levels} href="/risks/distribution" />
          </div>
          <Card coreClassName="gap-4 px-6 py-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-medium leading-[1.4]">Highest rated risks</h2>
              <Link href={`/risks/register/${data.departmentId || "all"}`} className="flex items-center gap-1 text-[13px] leading-normal text-ink-muted hover:text-ink">
                View all
                <ChevronRight className="size-3 text-ink" aria-hidden />
              </Link>
            </div>
            <RiskTable
              data={{ items: data.top, total: data.top.length, page: 1, perPage: data.top.length, facets: { departments: {}, ratings: { high: 0, medium: 0, low: 0 }, categories: [] } }}
              loading={false}
              filters={{ ...table, departmentId: data.departmentId }}
              onChange={({ departmentId: d, ...patch }) => {
                if (d !== undefined) setDepartmentId(d);
                setTable((t) => ({ ...t, ...patch }));
              }}
              empty={<p className="border-b border-line py-10 text-center text-[14px] text-ink-muted">No risks match these filters.</p>}
            />
          </Card>
        </>
      )}
    </div>
  );
}
