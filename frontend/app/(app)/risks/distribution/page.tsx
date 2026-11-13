"use client";

import { useState } from "react";
import { riskLevel } from "@/lib/risk";
import { currentMonth, DateFilter, monthLabel } from "@/components/risk-register/filter-menus";
import { usePeriod } from "@/contexts/period-context";
import { Dropdown } from "@/components/ui/dropdown";
import { HeatMap, type Cell } from "@/components/risks/heat-map";
import { RiskList } from "@/components/risks/risk-list";
import { useRegisters } from "@/hooks/queries/use-registers";
import { useDepartments, useRisks } from "@/hooks/queries/use-risks";

const RATINGS = [
  { id: "", name: "Any" },
  { id: "high", name: "High (15 to 25)" },
  { id: "medium", name: "Medium (9 to 14)" },
  { id: "low", name: "Low (1 to 8)" },
];

export default function RiskDistributionPage() {
  const [picked, setDepartmentId] = useState("");
  const [cell, setCell] = useState<Cell | null>(null);
  const [rating, setRating] = useState("");
  const departments = useDepartments();
  // A Risk Champion has one department, theirs, and cannot look at the others.
  const registers = useRegisters();
  const own = registers.data?.length === 1 ? registers.data[0]!.id : null;
  const departmentId = own ?? picked;
  const { month, setMonth } = usePeriod();
  const risks = useRisks(departmentId, month);

  const all = risks.data ?? [];
  // Picking a rating lights up its cells and narrows the list to its risks; picking a single cell overrides it.
  const inRating = (likelihood: number, impact: number) => !rating || riskLevel(likelihood * impact).toLowerCase() === rating;
  const shown = cell ? all.filter((r) => r.likelihood === cell.likelihood && r.impact === cell.impact) : rating ? all.filter((r) => inRating(r.likelihood, r.impact)) : all;
  const department = departments.data?.find((d) => d.id === departmentId);

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.96px]">Risk distribution</h1>
        {department && (
          <p className="text-[15px] leading-[1.6] text-ink-muted">
            {all.length} {all.length === 1 ? "risk" : "risks"} in {department.name}
          </p>
        )}
      </header>

      <div className="flex h-9 items-center justify-between">
        <div className="flex items-center gap-2">
        <Dropdown
          label="Department:"
          selectedId={departmentId}
          items={own ? (departments.data ?? []).filter((d) => d.id === own) : [{ id: "", name: "All departments" }, ...(departments.data ?? [])]}
          onSelect={(id) => {
            setDepartmentId(id);
            setCell(null);
          }}
        />
        <DateFilter label="Period" empty={monthLabel(currentMonth())} month={month} onApply={(m) => { setMonth(m); setCell(null); }} />
        <Dropdown label="Rating:" selectedId={rating} items={RATINGS} onSelect={(r) => { setRating(r); setCell(null); }} />
        </div>
        {((!own && departmentId) || cell || month || rating) && (
          <button
            className="cursor-pointer text-[14px] font-medium text-brand hover:underline"
            onClick={() => {
              setDepartmentId("");
              setMonth("");
              setRating("");
              setCell(null);
            }}
          >
            Clear selection
          </button>
        )}
      </div>

      {risks.isError ? (
        <p className="text-[14px] text-danger-fg">{risks.error.message}</p>
      ) : (
        <div className="flex flex-col gap-10 lg:flex-row lg:gap-14">
          <HeatMap risks={all} selected={cell} onSelect={setCell} highlight={rating && !cell ? (c) => inRating(c.likelihood, c.impact) : undefined} />
          <RiskList risks={shown} loading={risks.isPending} />
        </div>
      )}
    </div>
  );
}
