import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { DashboardData, DashboardSummary } from "@/lib/dashboard";
import type { RegisterFilters } from "@/hooks/queries/use-risk-register";

/** `table` is the Highest rated risks table's own sort and column filters; the cards ignore them. */
function tableParams(month: string, departmentId: string, table: RegisterFilters) {
  const live = table.status.filter((x) => x !== "archived");
  const p = new URLSearchParams({ month, departmentId, sort: table.sort, status: live.length === 1 ? live[0]! : "all", ownerId: table.ownerId });
  if (table.status.includes("archived")) p.set("archived", "true");
  if (table.rating.length) p.set("rating", table.rating.join(","));
  if (table.reviewState.length) {
    p.set("reviewState", table.reviewState.join(","));
    p.set("reviewMonth", month || new Date().toISOString().slice(0, 7));
  }
  return p;
}

/** Everything at once, for the printed report. */
export const useDashboard = (month: string, departmentId: string, table: RegisterFilters) => {
  const p = tableParams(month, departmentId, table);
  return useQuery({
    queryKey: ["dashboard", p.toString()],
    queryFn: () => api<DashboardData>(`/dashboard?${p}`),
    placeholderData: keepPreviousData,
  });
};

// The dashboard page loads its cards and its table as two requests, so the cards show as soon as their (cheaper) query returns.
// The cards do not depend on the table's filters, so sorting or filtering the table does not refetch them.
export const useDashboardSummary = (month: string, departmentId: string) => {
  const p = new URLSearchParams({ month, departmentId });
  return useQuery({
    queryKey: ["dashboard", "summary", p.toString()],
    queryFn: () => api<DashboardSummary>(`/dashboard/summary?${p}`),
    placeholderData: keepPreviousData,
  });
};

export const useDashboardTop = (month: string, departmentId: string, table: RegisterFilters) => {
  const p = tableParams(month, departmentId, table);
  return useQuery({
    queryKey: ["dashboard", "top", p.toString()],
    queryFn: () => api<{ top: DashboardData["top"] }>(`/dashboard/top?${p}`),
    placeholderData: keepPreviousData,
  });
};
