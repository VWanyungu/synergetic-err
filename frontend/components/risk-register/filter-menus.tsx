"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { cn } from "@/lib/utils";

const MENU = "absolute top-full z-30 mt-2 rounded-xl border border-line bg-surface shadow-[0_8px_24px_rgba(17,17,17,0.05),0_1px_3px_rgba(17,17,17,0.04)]";
const PILL_PRIMARY = "btn-primary btn-auto";

function Footer({ onClear, onApply }: { onClear: () => void; onApply: () => void }) {
  return (
    <div className="mt-1 flex items-center justify-between border-t border-line px-2.5 pt-2.5">
      <button type="button" onClick={onClear} className="cursor-pointer text-[14px] font-medium text-brand hover:underline">
        Clear
      </button>
      <button type="button" onClick={onApply} className={PILL_PRIMARY}>
        Apply
      </button>
    </div>
  );
}

export interface CheckOption<T extends string> {
  id: T;
  label: string;
  dot?: string;
  count?: number;
}

/** Multi-select checkbox list with Clear / Apply, used by the Rating and Status column filters. */
export function CheckMenu<T extends string>({
  options,
  value,
  onApply,
  align = "left",
}: {
  options: CheckOption<T>[];
  value: T[];
  onApply: (value: T[]) => void;
  align?: "left" | "right";
}) {
  const [draft, setDraft] = useState(value);
  const toggle = (id: T) => setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  return (
    <div className={cn(MENU, "w-[264px] px-2 pb-2.5 pt-3", align === "right" ? "right-0" : "left-0")} role="dialog">
      {options.map((o) => {
        const checked = draft.includes(o.id);
        return (
          <label key={o.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 hover:bg-field/60">
            <input type="checkbox" checked={checked} onChange={() => toggle(o.id)} className="sr-only" />
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                checked ? "border-brand bg-brand text-white" : "border-line-input bg-surface",
              )}
            >
              {checked && <Check className="size-3" strokeWidth={3} />}
            </span>
            {o.dot && <span className={cn("size-2 shrink-0 rounded-full", o.dot)} />}
            <span className="flex-1 text-[14px] leading-normal">{o.label}</span>
            {o.count !== undefined && <span className="text-[13px] text-placeholder">{o.count}</span>}
          </label>
        );
      })}
      <Footer
        onClear={() => {
          setDraft([]);
          onApply([]);
        }}
        onApply={() => onApply(draft)}
      />
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}

/** Year stepper and month grid. Future months are disabled. */
export function DateMenu({
  month,
  onApply,
  align = "right",
}: {
  month: string;
  onApply: (month: string) => void;
  align?: "left" | "right";
}) {
  const now = new Date();
  const [draftMonth, setMonth] = useState(month);
  const [year, setYear] = useState(month ? Number(month.slice(0, 4)) : now.getFullYear());
  const isFuture = (i: number) => year > now.getFullYear() || (year === now.getFullYear() && i > now.getMonth());
  const key = (i: number) => `${year}-${String(i + 1).padStart(2, "0")}`;

  return (
    <div className={cn(MENU, "flex w-[304px] flex-col gap-3.5 px-4 pb-3 pt-4", align === "right" ? "right-0" : "left-0")} role="dialog">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous year"
          onClick={() => setYear(year - 1)}
          className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-field"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <span className="text-[14px] font-medium">{year}</span>
        <button
          type="button"
          aria-label="Next year"
          disabled={year >= now.getFullYear()}
          onClick={() => setYear(year + 1)}
          className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-field disabled:cursor-default disabled:opacity-40"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {MONTHS.map((m, i) => {
          const disabled = isFuture(i);
          const selected = draftMonth === key(i);
          return (
            <button
              key={m}
              type="button"
              disabled={disabled}
              onClick={() => setMonth(selected ? "" : key(i))}
              className={cn(
                "h-9 rounded-none text-[14px] font-medium",
                disabled
                  ? "bg-subtle text-disabled"
                  : selected
                    ? "cursor-pointer border-b-2 border-brand bg-brand-bg text-brand-hover"
                    : "cursor-pointer bg-field hover:bg-line",
              )}
            >
              {m}
            </button>
          );
        })}
      </div>

      <Footer
        onClear={() => {
          setMonth("");
          onApply("");
        }}
        onApply={() => onApply(draftMonth)}
      />
    </div>
  );
}

/** Same pill as the other filter dropdowns; picking a year and month loads the register from that month's snapshot. */
export function DateFilter({ month, onApply, label = "Date", empty = "Any time" }: { month: string; onApply: (month: string) => void; label?: string; empty?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false));

  return (
    <div ref={ref} className="relative w-max" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-max cursor-pointer items-center gap-3 rounded-full border border-line-input bg-surface py-1.5 pl-4 pr-3 text-[13px]"
      >
        <span className="border-r border-line-input pr-3 text-ink-muted">{label}</span>
        <span className="whitespace-nowrap font-medium leading-[1.4]">{month ? monthLabel(month) : empty}</span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <DateMenu
          month={month}
          onApply={(m) => {
            onApply(m);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

/** This month as YYYY-MM, the period shown when none has been picked. */
export const currentMonth = () => new Date().toISOString().slice(0, 7);
