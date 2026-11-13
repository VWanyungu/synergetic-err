"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Archive, ArrowDown, ArrowUp, ChevronDown, ChevronRight, ChevronsUpDown, ChevronUp, CircleCheck, CircleDashed } from "lucide-react";
import { toast } from "sonner";
import { statusFiltered, useMitigationActions, type RegisterFilters } from "@/hooks/queries/use-risk-register";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { CheckMenu } from "@/components/risk-register/filter-menus";
import { DropdownList } from "@/components/ui/dropdown";
import { useMe } from "@/hooks/queries/use-me";
import { useRiskCommand } from "@/hooks/queries/use-risk-detail";
import { useRegisters } from "@/hooks/queries/use-registers";
import { useDepartments } from "@/hooks/queries/use-risks";
import { useRiskFormOptions } from "@/hooks/queries/use-create-risk";
import { Avatar } from "@/components/risk-detail/ui";
import { RisksSkeleton } from "@/components/risks/risks-empty";
import { LEVEL_TEXT, riskLevel, type MitigationAction, type RatingBand, type RegisterData, type RegisterRisk } from "@/lib/risk";
import { cn } from "@/lib/utils";

const COL = {
  department: "hidden w-[130px] shrink-0 lg:flex",
  rating: "w-[70px] shrink-0 sm:w-[90px]",
  owner: "hidden w-[140px] shrink-0 md:flex",
  status: "hidden w-[100px] shrink-0 sm:flex",
  date: "hidden w-[100px] shrink-0 lg:flex",
};
const HEAD = "text-[11px] font-medium uppercase leading-[1.3] tracking-[0.66px]";

const RESPONSE = { mitigate: "Mitigate", accept: "Accept", transfer: "Transfer", avoid: "Avoid" };
const ACTION_STATUS = {
  not_started: { label: "Not started", cls: "bg-subtle text-ink-muted" },
  in_progress: { label: "In progress", cls: "bg-warning-bg text-warning-fg" },
  completed: { label: "Completed", cls: "bg-success-bg text-success-fg" },
};

// en-GB spells September "Sept"; the design wants "Sep".
const fmt = (iso: string | null) => {
  if (!iso) return "Never";
  const d = new Date(iso);
  const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return `${String(d.getUTCDate()).padStart(2, "0")} ${month} ${d.getUTCFullYear()}`;
};

function Owner({ name }: { name: string | null }) {
  if (!name) return <span className="text-[14px] text-placeholder">Unassigned</span>;
  return (
    <>
      <Avatar name={name} size="xs" />
      <span className="truncate text-[14px] leading-normal">{name}</span>
    </>
  );
}

function StatusPill({ closed, archived }: { closed: boolean; archived: boolean }) {
  return archived ? (
    <span className="flex items-center gap-1.5 rounded-full border border-line bg-field py-[5px] pl-2.5 pr-3 text-[14px] font-medium leading-[1.4] text-ink-muted">
      <Archive className="size-4" />
      Archived
    </span>
  ) : closed ? (
    <span className="flex items-center gap-1.5 rounded-full border border-line bg-field py-[5px] pl-2.5 pr-3 text-[14px] font-medium leading-[1.4] text-ink-muted">
      <CircleDashed className="size-4" />
      Inactive
    </span>
  ) : (
    <span className="flex items-center gap-1.5 rounded-full bg-success-bg py-[5px] pl-2.5 pr-3 text-[14px] font-medium leading-[1.4] text-success-fg">
      <CircleCheck className="size-4" />
      Active
    </span>
  );
}

type MenuKey = "department" | "rating" | "owner" | "status" | "review";

function Header({
  filters,
  facets,
  onChange,
}: {
  filters: RegisterFilters;
  facets: RegisterData["facets"] | undefined;
  onChange: (patch: Partial<RegisterFilters>) => void;
}) {
  const [open, setOpen] = useState<MenuKey | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const owners = useRiskFormOptions();
  const registers = useRegisters();
  const departments = useDepartments();
  // On a division register the department filter is the owning department, so every department is on offer even to a champion.
  const departmentItems = filters.divisionId ? (departments.data ?? []) : (registers.data ?? []);
  const scoped = !filters.divisionId && registers.data?.length === 1;
  useOutsideClick(ref, () => setOpen(null));
  const toggle = (k: MenuKey) => setOpen(open === k ? null : k);
  const apply = (patch: Partial<RegisterFilters>) => {
    onChange(patch);
    setOpen(null);
  };

  // An active column (sorted or filtered) reads green.
  const cell = (active: boolean, isOpen: boolean) =>
    cn(
      HEAD,
      "-ml-1.5 flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded px-1.5 py-[5px]",
      active ? "text-brand" : isOpen ? "bg-field text-ink" : "text-ink-muted",
    );
  const caret = (isOpen: boolean) => (isOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />);
  // Counts only mean something when the table was loaded with facets (the dashboard table has none).
  const counts = facets && facets.ratings.high + facets.ratings.medium + facets.ratings.low > 0 ? facets.ratings : undefined;
  // Rating cycles: ascending, descending, then back to the default order.
  const ratingSort = filters.sort === "rating_asc" ? "asc" : filters.sort === "rating_desc" ? "desc" : null;
  const nextRating = ratingSort === null ? "rating_asc" : ratingSort === "asc" ? "rating_desc" : "latest";

  return (
    <div ref={ref} className="flex items-center gap-3 border-b border-line pb-3">
      <span className="w-6 shrink-0" />
      <div className={cn(HEAD, "flex h-7 flex-1 items-center text-ink-muted")}>Risk</div>
      <div className={cn("relative flex h-7 items-center", COL.department)}>
        <button type="button" onClick={() => toggle("department")} className={cell(!!filters.departmentId, open === "department")}>
          Department
          {caret(open === "department")}
        </button>
        {open === "department" && (
          <div className="absolute left-0 top-full z-30 mt-2 w-[260px] rounded-2xl border border-line bg-surface p-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.08)]" role="dialog">
            <DropdownList
              selectedId={filters.departmentId}
              items={[...(scoped ? [] : [{ id: "", name: "All departments" }]), ...departmentItems.map((r) => ({ id: r.id, name: r.name }))]}
              onSelect={(departmentId) => apply({ departmentId, page: 1 })}
            />
          </div>
        )}
      </div>
      <div className={cn("relative flex h-7 items-center gap-0.5", COL.rating)}>
        {/* The label filters by rating band; the arrows beside it sort. */}
        <button type="button" onClick={() => toggle("rating")} aria-label="Filter by rating" className={cell(filters.rating.length > 0, open === "rating")}>
          Rating
        </button>
        <button type="button" aria-label={`Sort by rating, currently ${ratingSort ?? "not sorted"}`} onClick={() => onChange({ sort: nextRating })} className={cn("flex size-5 cursor-pointer items-center justify-center rounded", ratingSort ? "text-brand" : "text-ink-muted")}>
          {ratingSort === "asc" ? <ArrowUp className="size-3" /> : ratingSort === "desc" ? <ArrowDown className="size-3" /> : <ChevronsUpDown className="size-3" />}
        </button>
        {open === "rating" && (
          <CheckMenu<RatingBand>
            value={filters.rating}
            onApply={(rating) => apply({ rating, page: 1 })}
            options={[
              { id: "high", label: "High (15 to 25)", dot: "bg-red-500", count: counts?.high },
              { id: "medium", label: "Medium (9 to 14)", dot: "bg-amber-500", count: counts?.medium },
              { id: "low", label: "Low (1 to 8)", dot: "bg-green-400", count: counts?.low },
            ]}
          />
        )}
      </div>
      <div className={cn("relative flex h-7 items-center", COL.owner)}>
        <button type="button" onClick={() => toggle("owner")} className={cell(!!filters.ownerId, open === "owner")}>
          Owner
          {caret(open === "owner")}
        </button>
        {open === "owner" && (
          // The option list itself, straight under the header, with no card or trigger around it.
          <div className="absolute left-0 top-full z-30 mt-2 w-[240px] rounded-2xl border border-line bg-surface p-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.08)]" role="dialog">
            <DropdownList
              selectedId={filters.ownerId}
              items={[{ id: "", name: "All owners" }, ...(owners.data?.owners ?? [])]}
              onSelect={(ownerId) => apply({ ownerId, page: 1 })}
            />
          </div>
        )}
      </div>
      <div className={cn("relative flex h-7 items-center", COL.status)}>
        <button type="button" onClick={() => toggle("status")} className={cell(statusFiltered(filters.status), open === "status")}>
          Status
          {caret(open === "status")}
        </button>
        {open === "status" && (
          <CheckMenu<"active" | "inactive" | "archived">
            align="right"
            value={filters.status}
            onApply={(status) => apply({ status, page: 1 })}
            options={[
              { id: "active", label: "Active" },
              { id: "inactive", label: "Inactive" },
              { id: "archived", label: "Archived" },
            ]}
          />
        )}
      </div>
      <div className={cn("relative flex h-7 items-center", COL.date)}>
        <button type="button" onClick={() => toggle("review")} className={cell(filters.reviewState.length === 1, open === "review")}>
          Last review
          {caret(open === "review")}
        </button>
        {open === "review" && (
          <CheckMenu<"reviewed" | "not_reviewed">
            align="right"
            value={filters.reviewState}
            onApply={(reviewState) => apply({ reviewState, page: 1 })}
            options={[
              { id: "reviewed", label: "Reviewed" },
              { id: "not_reviewed", label: "Not reviewed" },
            ]}
          />
        )}
      </div>
    </div>
  );
}

function Scale({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-2">
      <span className={cn(HEAD, "text-ink-muted")}>{label}</span>
      <div className="flex items-center gap-3">
        <span className="flex items-end gap-1 whitespace-nowrap">
          <span className="text-[14px] font-medium leading-[1.4]">{value}</span>
          <span className="text-[13px] leading-normal text-ink-muted">/ 5</span>
        </span>
        <span className="flex gap-[3px]">
          {[1, 2, 3, 4, 5].map((i) => (
            <span key={i} className={cn("h-1 w-[18px] rounded-full", i <= value ? "bg-ink" : "bg-line-input")} />
          ))}
        </span>
      </div>
    </div>
  );
}

/** `compact` drops the empty spacer columns that line the panel up with the full register columns, so the actions get the room. */
function Panel({ risk, compact }: { risk: RegisterRisk; compact?: boolean }) {
  const actions = useMitigationActions(risk.id, true);
  // Same rule as the risk page: Admin and Risk Officer anywhere, a Risk Champion in their own department.
  const me = useMe().data;
  const canReview = !!me && (me.roles.some((r) => r.role === "Admin" || r.role === "Risk Officer") || (me.roles.some((r) => r.role === "Risk Champion") && me.departmentId === risk.departmentId));
  const review = useRiskCommand(risk.id, "review");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="border-b border-line pb-4">
      <div className="rounded-md bg-subtle pb-0.5 pt-3.5">
        <div className="flex flex-wrap gap-x-14 gap-y-4 border-b border-line pb-4 pl-9 pr-6">
          <div className="flex flex-col gap-2">
            <span className={cn(HEAD, "text-ink-muted")}>Risk ID</span>
            <span className="font-mono text-[13px] leading-normal">{risk.code}</span>
          </div>
          <Scale label="Impact" value={risk.impact} />
          <Scale label="Likelihood" value={risk.likelihood} />
          <div className="flex flex-col gap-2">
            <span className={cn(HEAD, "text-ink-muted")}>Risk response</span>
            <span className="text-[14px] font-medium leading-[1.4]">{RESPONSE[risk.riskResponse]}</span>
          </div>
          {canReview && (
            <button
              type="button"
              disabled={review.isPending}
              onClick={() => review.mutate(undefined, { onSuccess: () => toast.success("Review logged"), onError: (e) => toast.error(e.message) })}
              className="ml-auto flex h-8 cursor-pointer items-center gap-1.5 self-end rounded-full bg-surface px-3 text-[13px] font-medium transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-line active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {/* <CircleCheck className="size-3.5 text-brand" aria-hidden /> */}
              Log review
            </button>
          )}
        </div>

        <div className="mt-3.5 flex items-center gap-3 pb-0.5">
          <span className="w-6 shrink-0" />
          <span className={cn(HEAD, "flex-1 text-ink-muted")}>Mitigation actions</span>
          {!compact && (
            <>
              <span className={cn(HEAD, "hidden w-[130px] shrink-0 lg:block")} />
              <span className={cn("w-[70px] shrink-0 sm:w-[90px]")} />
            </>
          )}
          <span className={cn(HEAD, "hidden w-[140px] shrink-0 text-ink-muted md:block")}>Owner</span>
          <span className={cn(HEAD, "hidden w-[100px] shrink-0 text-ink-muted sm:block")}>Status</span>
          <span className={cn(HEAD, "hidden w-[100px] shrink-0 text-ink-muted lg:block")}>Due date</span>
        </div>

        {actions.isPending ? (
          <div className="h-[47px] animate-pulse border-t border-line" />
        ) : actions.isError ? (
          <p className="px-9 py-3 text-[14px] text-danger-fg">{actions.error.message}</p>
        ) : actions.data.length === 0 ? (
          <p className="border-t border-line px-9 py-3 text-[14px] text-ink-muted">No mitigation actions yet.</p>
        ) : (
          actions.data.map((a: MitigationAction) => {
            const overdue = !!a.dueDate && a.status !== "completed" && a.dueDate < today;
            return (
              <div key={a.id} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0 [&:not(:first-of-type)]:border-t">
                <span className="w-6 shrink-0" />
                <span className="min-w-0 flex-1 text-[14px] font-medium leading-[1.4]">{a.title}</span>
                {!compact && (
                  <>
                    <span className="hidden w-[130px] shrink-0 lg:block" />
                    <span className="w-[70px] shrink-0 sm:w-[90px]" />
                  </>
                )}
                <span className="hidden w-[140px] shrink-0 items-center gap-2 md:flex">
                  <Owner name={a.owner} />
                </span>
                <span className="hidden w-[100px] shrink-0 sm:flex">
                  <span className={cn("flex h-[22px] items-center rounded-full px-2 text-[13px] leading-normal", ACTION_STATUS[a.status].cls)}>
                    {ACTION_STATUS[a.status].label}
                  </span>
                </span>
                <span className={cn("hidden w-[100px] shrink-0 text-[14px] leading-normal lg:block", overdue ? "text-danger-fg" : "text-ink-muted")}>
                  {fmt(a.dueDate)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/** One expandable risk row. `compact` leaves out the status and last review columns, for narrower spaces. */
export function Row({ risk, expanded, onToggle, compact }: { risk: RegisterRisk; expanded: boolean; onToggle: () => void; compact?: boolean }) {
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onToggle())}
        className={cn("flex cursor-pointer items-center gap-3 py-4 hover:bg-field/30", !expanded && "border-b border-line")}
      >
        <span className="flex w-6 shrink-0 items-center">
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Link href={`/risks/${risk.id}`} className="text-[14px] font-medium leading-[1.4] hover:text-brand hover:underline">{risk.title}</Link>
          <span className="text-[13px] leading-normal text-ink-muted">{risk.category}</span>
        </span>
        <span className={cn("items-center text-[14px] leading-normal", COL.department)}>{risk.department}</span>
        <span className={cn("flex items-center text-[15px] font-medium leading-[1.6]", COL.rating, LEVEL_TEXT[riskLevel(risk.rating)])}>
          {risk.rating}
        </span>
        <span className={cn("items-center gap-2", COL.owner)}>
          <Owner name={risk.owner} />
        </span>
        {!compact && (
          <>
            <span className={cn("items-center", COL.status)}>
              <StatusPill closed={risk.status === "closed"} archived={!!risk.archivedAt} />
            </span>
            <span className={cn("items-center text-[14px] leading-normal text-ink-muted", COL.date)}>{fmt(risk.lastReviewedAt)}</span>
          </>
        )}
      </div>
      {expanded && <Panel risk={risk} compact={compact} />}
    </>
  );
}

export function RiskTable({
  data,
  loading,
  filters,
  onChange,
  empty,
}: {
  data: RegisterData | undefined;
  loading: boolean;
  filters: RegisterFilters;
  onChange: (patch: Partial<RegisterFilters>) => void;
  empty: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div>
      <Header filters={filters} facets={data?.facets} onChange={onChange} />
      {loading ? (
        <RisksSkeleton />
      ) : data && data.items.length === 0 ? (
        empty
      ) : (
        data?.items.map((r) => (
          <Row key={r.id} risk={r} expanded={expanded === r.id} onToggle={() => setExpanded(expanded === r.id ? null : r.id)} />
        ))
      )}
    </div>
  );
}
