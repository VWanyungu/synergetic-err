"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LayoutGrid, Rows3 } from "lucide-react";
import { Alert } from "@/components/auth/auth-ui";
import { RegisterCards, RegisterTable } from "@/components/registers/registers-view";
import { useDivisions, useRegisters } from "@/hooks/queries/use-registers";
import { cn } from "@/lib/utils";

const ICON = "absolute inset-0 size-[18px] transition-[transform,opacity] duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none";

function AllRegisters() {
  const [view, setView] = useState<"cards" | "table">("cards");
  // The navbar menu can link straight to the Divisions tab.
  const [kind, setKind] = useState<"department" | "division">(useSearchParams().get("kind") === "division" ? "division" : "department");
  const departments = useRegisters();
  const divisions = useDivisions();
  const registers = kind === "division" ? divisions : departments;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-4">
          <h1 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.96px]">All registers</h1>
          {/* Segmented switch: a raised pill slides under the active label. */}
          <div className="relative grid w-max grid-cols-2 rounded-full bg-field p-1" role="tablist" aria-label="Register type">
            <span
              aria-hidden
              className={cn(
                "absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-surface shadow-[0_1px_3px_rgba(17,17,17,0.1)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                kind === "division" && "translate-x-full",
              )}
            />
            {([["department", "Departments"], ["division", "Divisions"]] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={kind === id}
                onClick={() => setKind(id)}
                className={cn("relative z-10 cursor-pointer px-4 py-1.5 text-[13px] font-medium leading-[1.4] transition-colors duration-300", kind === id ? "text-ink" : "text-ink-muted")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {/* One button, like the theme switch: it shows the view you would switch to. */}
        <button
          type="button"
          onClick={() => setView(view === "cards" ? "table" : "cards")}
          aria-label={view === "cards" ? "Switch to table view" : "Switch to card view"}
          title={view === "cards" ? "Table view" : "Card view"}
          className="flex size-9 cursor-pointer items-center justify-center rounded-full hover:bg-field"
        >
          <span className="relative block size-[18px] overflow-hidden">
            <Rows3 className={cn(ICON, view === "cards" ? "translate-y-0 opacity-100" : "translate-y-full opacity-0")} aria-hidden />
            <LayoutGrid className={cn(ICON, view === "table" ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0")} aria-hidden />
          </span>
        </button>
      </header>

      {registers.isError ? (
        <div className="flex flex-col items-start gap-3">
          <Alert variant="error" title="Could not load the registers">{registers.error.message}</Alert>
          <button type="button" className="btn-secondary btn-auto" onClick={() => registers.refetch()}>Try again</button>
        </div>
      ) : registers.isPending ? (
        <div aria-busy="true" aria-label="Loading registers" className="h-[640px] animate-pulse rounded-[32px] bg-field" />
      ) : registers.data.length === 0 ? (
        <p className="py-16 text-center text-[14px] text-ink-muted">No {kind === "division" ? "divisions" : "departments"} yet.</p>
      ) : view === "cards" ? (
        <div key={`cards-${kind}`} className="animate-fade-up"><RegisterCards registers={registers.data} kind={kind} /></div>
      ) : (
        <div key={`table-${kind}`} className="animate-fade-up"><RegisterTable registers={registers.data} kind={kind} /></div>
      )}
    </div>
  );
}

export default function AllRegistersPage() {
  return (
    <Suspense>
      <AllRegisters />
    </Suspense>
  );
}
