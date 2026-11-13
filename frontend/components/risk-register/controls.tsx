"use client";

import { useRef, useState } from "react";
import { ChevronRight, ChevronsUpDown, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { DropdownList, type DropdownItem } from "@/components/ui/dropdown";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { cn } from "@/lib/utils";

const PILL = "rounded-full";

/** The last breadcrumb crumb as a quick switcher: a bare up/down icon that opens the list of siblings, straight up, with nothing around it. */
function CrumbSwitcher({ items, selectedId, onSelect }: { items: DropdownItem[]; selectedId: string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useOutsideClick(ref, () => setOpen(false));
  return (
    <span ref={ref} className="relative flex" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <button type="button" aria-label="Switch register" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)} className="flex size-5 cursor-pointer items-center justify-center rounded text-ink-muted hover:text-ink">
        <ChevronsUpDown className="size-3.5" aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[240px] rounded-2xl border border-line bg-surface p-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
          <DropdownList items={items} selectedId={selectedId} onSelect={(id) => { setOpen(false); onSelect(id); }} />
        </div>
      )}
    </span>
  );
}

export function PageHeader({ kind, name, switcher }: { kind: "department" | "division"; name: string; switcher?: { items: DropdownItem[]; selectedId: string; onSelect: (id: string) => void } }) {
  return (
    <div className="flex flex-col gap-2">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 pb-3 text-[14px] leading-normal">
        <Link href="/risks" className="text-brand hover:underline">All registers</Link>
        <ChevronRight className="size-3 text-ink-muted" aria-hidden />
        <Link href={kind === "division" ? "/risks?kind=division" : "/risks"} className="text-brand hover:underline">{kind === "division" ? "Division register" : "Department register"}</Link>
        <ChevronRight className="size-3 text-ink-muted" aria-hidden />
        <span className="text-ink-muted">{name}</span>
        {switcher && <CrumbSwitcher {...switcher} />}
      </nav>
      <div className="flex items-end justify-between">
        <h1 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.96px]">Risk Register</h1>
        <Link href="/risks/new" className="btn-primary btn-auto">
          <Plus className="size-[18px]" strokeWidth={2.5} />
          New risk
        </Link>
      </div>
    </div>
  );
}

export function SearchBar({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
  const [draft, setDraft] = useState(value);
  // Keep the box in step when the filter is cleared from its chip.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(draft.trim());
      }}
      className="flex h-14 items-center gap-3 rounded-full bg-field pl-[26px] pr-2"
    >
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Search risks by title, ID, owner or category"
        aria-label="Search risks"
        className="min-w-0 flex-1 bg-transparent text-[15px] leading-[1.6] outline-none placeholder:text-placeholder"
      />
      <button type="submit" aria-label="Search" className="btn-primary btn-auto !size-10 !p-0">
        <Search className="size-5" />
      </button>
    </form>
  );
}

export interface Chip {
  id: string;
  label: string;
  /** Omitted when the filter is fixed and cannot be removed. */
  onRemove?: () => void;
}

export function ActiveFilters({ chips, onClearAll, children }: { chips: Chip[]; onClearAll: () => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      {chips.length > 0 && (
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <span key={c.id} className={cn(PILL, "flex items-center gap-1.5 bg-field py-1.5 pl-3 text-[14px] font-medium leading-[1.4]", c.onRemove ? "pr-2" : "pr-3")}>
                {c.label}
                {c.onRemove && (
                  <button type="button" aria-label={`Remove ${c.label}`} onClick={c.onRemove} className="cursor-pointer">
                    <X className="size-3" strokeWidth={2.5} />
                  </button>
                )}
              </span>
            ))}
          </div>
          <button type="button" onClick={onClearAll} className="shrink-0 cursor-pointer py-1.5 text-[14px] font-medium text-brand hover:underline">
            Clear filters
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">{children}</div>
    </div>
  );
}
