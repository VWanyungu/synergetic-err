import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { MitigationAction, QuickFilter, RatingBand, RegisterData } from "@/lib/risk";

export const PER_PAGE = 8;

export interface RegisterFilters {
  departmentId: string;
  /** Show the risks that affect this department rather than the ones it owns. */
  divisionId: string;
  q: string;
  quick: QuickFilter[];
  /** Active / inactive: both or neither means no filter. Archived shows archived risks (the "deleted" ones) instead. */
  status: ("active" | "inactive" | "archived")[];
  category: string;
  rating: RatingBand[];
  /** YYYY-MM: show the register as the monthly snapshot recorded it. Empty means today. */
  month: string;
  /** Last review column filter: reviewed (ever) and/or never reviewed. */
  reviewState: ("reviewed" | "not_reviewed")[];
  ownerId: string;
  /** Risk response (the Mitigation filter): accept, mitigate, transfer or avoid. */
  response: string;
  sort: string;
  page: number;
}

export const DEFAULT_FILTERS: RegisterFilters = {
  departmentId: "",
  divisionId: "",
  q: "",
  quick: [],
  status: ["active"],
  category: "",
  rating: [],
  month: "",
  reviewState: [],
  ownerId: "",
  response: "",
  sort: "latest",
  page: 1,
};

function toQuery(f: RegisterFilters) {
  const p = new URLSearchParams({ page: String(f.page), perPage: String(PER_PAGE), sort: f.sort });
  const live = f.status.filter((x) => x !== "archived");
  if (live.length === 1) p.set("status", live[0]!);
  if (f.departmentId) p.set("departmentId", f.departmentId);
  if (f.divisionId) p.set("divisionId", f.divisionId);
  if (f.q) p.set("q", f.q);
  const quick = f.status.includes("archived") ? [...f.quick, "archived"] : f.quick;
  if (quick.length) p.set("quick", quick.join(","));
  if (f.category) p.set("category", f.category);
  if (f.rating.length) p.set("rating", f.rating.join(","));
  if (f.month) p.set("month", f.month);
  // Reviewed / not reviewed is always about a period: the one picked, or this month.
  if (f.reviewState.length) {
    p.set("reviewState", f.reviewState.join(","));
    p.set("reviewMonth", f.month || new Date().toISOString().slice(0, 7));
  }
  if (f.ownerId) p.set("ownerId", f.ownerId);
  if (f.response) p.set("response", f.response);
  return p.toString();
}

export const useRiskRegister = (filters: RegisterFilters) =>
  useQuery({
    queryKey: ["risk-register", filters],
    queryFn: () => api<RegisterData>(`/risks/register?${toQuery(filters)}`),
    placeholderData: keepPreviousData,
  });

export const useMitigationActions = (riskId: string, enabled: boolean) =>
  useQuery({
    queryKey: ["mitigation-actions", riskId],
    queryFn: () => api<MitigationAction[]>(`/risks/${riskId}/actions`),
    enabled,
  });

/** True when the Status column is narrowing the list: anything but the both-or-neither of active and inactive. */
export const statusFiltered = (status: RegisterFilters["status"]) =>
  status.includes("archived") || status.length === 1;
