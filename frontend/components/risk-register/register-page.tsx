"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Dropdown } from "@/components/ui/dropdown";
import { ActiveFilters, PageHeader, SearchBar, type Chip } from "@/components/risk-register/controls";
import { currentMonth, DateFilter, monthLabel } from "@/components/risk-register/filter-menus";
import { RiskTable } from "@/components/risk-register/risk-table";
import { RisksEmpty } from "@/components/risks/risks-empty";
import { DEFAULT_FILTERS, PER_PAGE, statusFiltered, useRiskRegister, type RegisterFilters } from "@/hooks/queries/use-risk-register";
import { useDivisions, useRegisters } from "@/hooks/queries/use-registers";
import { useRiskFormOptions } from "@/hooks/queries/use-create-risk";
import { usePeriod } from "@/contexts/period-context";
import { useDepartments } from "@/hooks/queries/use-risks";

// Mitigation is the risk's chosen response.
const MITIGATION = [
  { id: "", name: "Any" },
  { id: "accept", name: "Accept" },
  { id: "mitigate", name: "Mitigate" },
  { id: "transfer", name: "Transfer" },
  { id: "avoid", name: "Avoid" },
  // Not a response but a gap: risks that have no mitigation plan at all.
  { id: "noPlan", name: "No mitigation plan" },
];

const ORDERS = [
  { id: "latest", name: "Latest" },
  { id: "rating_desc", name: "Highest rating" },
  { id: "rating_asc", name: "Lowest rating" },
  { id: "reviewed", name: "Last reviewed" },
  { id: "title", name: "Title (A to Z)" },
  { id: "department", name: "Department" },
  { id: "owner", name: "Owner" },
  { id: "status", name: "Status" },
];

// Switching register (a department, a division) remounts the page, which would drop every filter you had on.
// The filters are parked here just before navigating and picked up by the next page.
let carried: RegisterFilters | null = null;

/**
 * One register page, two ways in. A department register lists the risks a department owns ("all" is the whole
 * enterprise); a division register lists the risks, from any department, that affect that division.
 */
export function RegisterPage({ mode, id }: { mode: "department" | "division"; id: string }) {
  const router = useRouter();
  const division = mode === "division";
  const { month, setMonth } = usePeriod();
  // The dashboard links here with filters already chosen (category, review, response) and every status shown.
  const params = useSearchParams();
  const [state, setState] = useState<RegisterFilters>(() => carried ?? { ...DEFAULT_FILTERS, category: params.get("category") ?? "", status: params.get("status") === "all" ? [] : DEFAULT_FILTERS.status, reviewState: params.get("review") === "reviewed" ? ["reviewed"] : [], response: params.get("response") ?? "", quick: params.get("quick") === "noMitigation" ? ["noMitigation"] : [] });
  useEffect(() => {
    carried = null;
  }, []);
  // Go to another register, keeping the filters that were on.
  const switchTo = (href: string) => {
    carried = { ...state, page: 1 };
    router.push(href);
  };
  // A department register's department comes from the route ("all" means none). On a division register it is an ordinary filter.
  const routeDepartment = division ? state.departmentId : id === "all" ? "" : id;
  const filters = { ...state, departmentId: routeDepartment, divisionId: division ? id : "", month };
  const departments = useDepartments();
  const owners = useRiskFormOptions();
  const registers = useRegisters();
  const divisions = useDivisions();
  // A Risk Champion has exactly one register and one division: their own. They are fixed, not filters to drop.
  const list = division ? divisions : registers;
  const own = list.data?.length === 1 ? list.data[0]!.id : null;
  const base = division ? "/risks/division" : "/risks/register";
  useEffect(() => {
    if (own && id !== own) router.replace(`${base}/${own}`);
  }, [own, id, base, router]);
  const register = useRiskRegister(filters);
  const data = register.data;
  const nameOf = (unitId: string, isDivision: boolean = division) =>
    (isDivision ? divisions.data : departments.data)?.find((d) => d.id === unitId)?.name ?? "…";
  const registerName = division ? `${nameOf(id, true)} division` : routeDepartment ? `${nameOf(routeDepartment, false)} register` : "All departments";
  const departmentId = routeDepartment;

  // Any filter change goes back to page 1, unless it is the page change itself.
  const change = ({ month: m, departmentId: d, ...patch }: Partial<RegisterFilters>) => {
    if (m !== undefined) setMonth(m);
    if (d !== undefined) {
      // On a department register the department is the register being viewed, so picking another opens that register.
      if (division) setState((f) => ({ ...f, departmentId: d }));
      else switchTo(`/risks/register/${d || "all"}`);
    }
    setState((f) => ({ ...f, page: 1, ...patch }));
  };

  // One dropdown, two kinds of filter: a risk response, or the absence of any plan.
  const mitigation = filters.quick.includes("noMitigation") ? "noPlan" : filters.response;
  const pickMitigation = (id: string) =>
    change({ response: id === "noPlan" ? "" : id, quick: id === "noPlan" ? [...filters.quick, "noMitigation"] : filters.quick.filter((k) => k !== "noMitigation") });

  const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
  const chips: Chip[] = [
    ...(division
      ? [{ id: "division", label: `Division: ${nameOf(id, true)}`, onRemove: own ? undefined : () => router.push("/risks") }]
      : departmentId
        ? [{ id: "register", label: `Register: ${registerName.replace(/ register$/, "")}`, onRemove: own ? undefined : () => router.push("/risks/register/all") }]
        : []),
    ...(division && departmentId ? [{ id: "department", label: `Department: ${nameOf(departmentId, false)}`, onRemove: () => change({ departmentId: "" }) }] : []),
    ...(statusFiltered(filters.status) ? [{ id: "status", label: `Status: ${filters.status.map(cap).join(", ")}`, onRemove: () => change({ status: [] }) }] : []),
    ...(filters.rating.length ? [{ id: "rating", label: `Rating: ${filters.rating.map(cap).join(", ")}`, onRemove: () => change({ rating: [] }) }] : []),
    ...(filters.month ? [{ id: "month", label: `Snapshot: ${monthLabel(filters.month)}`, onRemove: () => change({ month: "" }) }] : []),
    ...(filters.reviewState.length === 1
      ? [{ id: "review", label: `${filters.reviewState[0] === "reviewed" ? "Reviewed" : "Not reviewed"}: ${monthLabel(filters.month || currentMonth())}`, onRemove: () => change({ reviewState: [] }) }]
      : []),
    ...(mitigation ? [{ id: "mitigation", label: `Mitigation: ${MITIGATION.find((m) => m.id === mitigation)!.name}`, onRemove: () => pickMitigation("") }] : []),
    ...(filters.ownerId ? [{ id: "owner", label: `Owner: ${owners.data?.owners.find((o) => o.id === filters.ownerId)?.name ?? "…"}`, onRemove: () => change({ ownerId: "" }) }] : []),
    ...(filters.category ? [{ id: "category", label: `Category: ${filters.category}`, onRemove: () => change({ category: "" }) }] : []),
    ...(filters.sort !== "latest" ? [{ id: "order", label: `Order: ${ORDERS.find((o) => o.id === filters.sort)?.name ?? filters.sort}`, onRemove: () => change({ sort: "latest" }) }] : []),
    ...(filters.q ? [{ id: "q", label: `Search: ${filters.q}`, onRemove: () => change({ q: "" }) }] : []),
  ];
  const clearAll = () => {
    change({ status: [], quick: [], response: "", rating: [], month: "", reviewState: [], ownerId: "", q: "", category: "", sort: "latest", ...(division ? { departmentId: "" } : {}) });
    if (!division && departmentId && !own) router.push("/risks/register/all");
  };

  const hasFilters = chips.length > 0;
  const from = data ? (data.page - 1) * data.perPage + 1 : 0;
  const to = data ? Math.min(data.page * data.perPage, data.total) : 0;
  const noun = data?.total === 1 ? "risk" : "risks";
  const summary = `Showing ${from === to ? from : `${from} to ${to}`} of ${data?.total} ${noun} in the ${division || departmentId ? registerName : "enterprise register"}${filters.month ? `, as at ${monthLabel(filters.month)}` : ""}`;
  const lastPage = data ? Math.ceil(data.total / PER_PAGE) : 1;

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        kind={mode}
        name={division ? nameOf(id, true) : routeDepartment ? nameOf(routeDepartment, false) : "All departments"}
        switcher={
          division
            ? (divisions.data?.length ?? 0) > 1 ? { items: divisions.data!.map((d) => ({ id: d.id, name: d.name })), selectedId: id, onSelect: (next) => switchTo(`/risks/division/${next}`) } : undefined
            : (registers.data?.length ?? 0) > 1 ? { items: [{ id: "", name: "All departments" }, ...registers.data!.map((d) => ({ id: d.id, name: d.name }))], selectedId: routeDepartment, onSelect: (next) => switchTo(`/risks/register/${next || "all"}`) } : undefined
        }
      />
      <SearchBar value={filters.q} onSearch={(q) => change({ q })} />
      <ActiveFilters chips={chips} onClearAll={clearAll}>
        <Dropdown
          label="Category:"
          align="right"
          selectedId={filters.category}
          items={[{ id: "", name: "All categories" }, ...(data?.facets.categories ?? []).map((c) => ({ id: c, name: c }))]}
          onSelect={(category) => change({ category })}
        />
        <Dropdown label="Mitigation:" align="right" selectedId={mitigation} items={MITIGATION} onSelect={pickMitigation} />
        <DateFilter label="Period" empty={monthLabel(currentMonth())} month={filters.month} onApply={(m) => change({ month: m })} />
        <Dropdown label="Order:" align="right" selectedId={filters.sort} items={ORDERS} onSelect={(sort) => change({ sort })} />
      </ActiveFilters>

      {register.isError ? (
        <p className="text-[14px] text-danger-fg">{register.error.message}</p>
      ) : (
        <>
          <RiskTable
            data={data}
            loading={register.isPending}
            filters={filters}
            onChange={change}
            empty={
              hasFilters ? (
                <p className="border-b border-line py-10 text-center text-[14px] text-ink-muted">
                  No risks match these filters.{" "}
                  <button type="button" className="cursor-pointer font-medium text-brand hover:underline" onClick={clearAll}>
                    Clear filters
                  </button>
                </p>
              ) : (
                <RisksEmpty />
              )
            }
          />
          {data && data.total > 0 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-[14px] leading-normal text-ink-muted">{summary}</p>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary btn-auto" disabled={filters.page <= 1} onClick={() => setState((f) => ({ ...f, page: f.page - 1 }))}>
                  Previous
                </button>
                <button type="button" className="btn-secondary btn-auto" disabled={filters.page >= lastPage} onClick={() => setState((f) => ({ ...f, page: f.page + 1 }))}>
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
