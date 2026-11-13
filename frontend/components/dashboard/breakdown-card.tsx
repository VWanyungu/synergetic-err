"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/dashboard/card";
import type { BreakdownRow, DashboardData } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "department", label: "Department" },
  { id: "category", label: "Category" },
  { id: "division", label: "Division" },
] as const;
const BANDS = [
  { key: "high", bar: "bg-red-500" },
  { key: "medium", bar: "bg-amber-500" },
  { key: "low", bar: "bg-green-400" },
] as const;
const COLS = "grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_40px] items-center gap-3 sm:gap-4";
const HEAD = "text-[11px] font-medium uppercase leading-[1.3] tracking-[0.66px] text-ink-muted";

const hrefFor = (tab: string, row: BreakdownRow, departmentId: string) =>
  // status=all: the dashboard counts active and inactive risks, so the register it opens should too.
  tab === "department" ? `/risks/register/${row.id}?status=all` : tab === "division" ? `/risks/division/${row.id}?status=all` : `/risks/register/${departmentId || "all"}?status=all&category=${encodeURIComponent(row.id)}`;

function Row({ row, longest, href }: { row: BreakdownRow; longest: number; href: string }) {
  return (
    <Link href={href} className={cn(COLS, "group -mx-2 rounded-md px-2 py-1 hover:bg-subtle")}>
      <span className="truncate text-[14px] leading-normal group-hover:text-brand group-hover:underline" title={row.name}>{row.name}</span>
      <span className="flex h-2.5 gap-0.5" style={{ width: `${(row.total / longest) * 100}%` }} role="img" aria-label={`${row.high} high, ${row.medium} medium, ${row.low} low`}>
        {BANDS.map((b) => (row[b.key] ? <span key={b.key} className={cn("h-full rounded-[2px]", b.bar)} style={{ flexGrow: row[b.key], flexBasis: 0 }} /> : null))}
      </span>
      <span className="text-right text-[14px] leading-normal">{row.total}</span>
    </Link>
  );
}

/** Each row opens the register behind it: a department's, a division's, or a category within the department being viewed. */
export function BreakdownCard({ data, className, categoryOnly, departmentId }: { data: DashboardData["breakdown"]; className?: string; categoryOnly?: boolean; departmentId: string }) {
  // A department-limited user has nothing to compare across departments, so Department is not offered.
  const tabs = TABS.filter((t) => !(categoryOnly && t.id === "department"));
  const [picked, setTab] = useState<(typeof TABS)[number]["id"]>("department");
  const tab = tabs.some((t) => t.id === picked) ? picked : tabs[0]!.id;
  const rows = data[tab];
  const longest = Math.max(1, ...rows.map((r) => r.total));

  return (
    <Card className={className} coreClassName="gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-medium leading-[1.4]">Risk breakdown</h2>
        <div className="flex gap-1" role="group" aria-label="Group by">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn("h-[30px] cursor-pointer rounded-full px-3 text-[13px] font-medium transition-colors duration-300", tab === t.id ? "bg-field text-ink" : "text-ink-muted hover:bg-field/60")}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className={cn(COLS, "mt-1")}>
        <span className={HEAD}>{TABS.find((t) => t.id === tab)!.label}</span>
        <span className={HEAD}>Level split</span>
        <span className={cn(HEAD, "text-right")}>Risks</span>
      </div>
      <div className="flex max-h-[304px] flex-col gap-3.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rows.length === 0 ? <p className="py-8 text-center text-[14px] text-ink-muted">No risks in this period.</p> : rows.map((r) => <Row key={r.id} row={r} longest={longest} href={hrefFor(tab, r, departmentId)} />)}
      </div>
    </Card>
  );
}
