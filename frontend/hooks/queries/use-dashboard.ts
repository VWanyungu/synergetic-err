import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { DashboardData } from "@/lib/dashboard";
import type { RegisterFilters } from "@/hooks/queries/use-risk-register";

/** `table` is the Highest rated risks table's own sort and column filters; the cards ignore them. */
export const useDashboard = (month: string, departmentId: string, table: RegisterFilters) => {
  const live = table.status.filter((x) => x !== "archived");
  const p = new URLSearchParams({ month, departmentId, sort: table.sort, status: live.length === 1 ? live[0]! : "all", ownerId: table.ownerId });
  if (table.status.includes("archived")) p.set("archived", "true");
  if (table.rating.length) p.set("rating", table.rating.join(","));
  if (table.reviewState.length) {
    p.set("reviewState", table.reviewState.join(","));
    p.set("reviewMonth", month || new Date().toISOString().slice(0, 7));
  }
  return useQuery({
    queryKey: ["dashboard", p.toString()],
    queryFn: () => api<DashboardData>(`/dashboard?${p}`),
    placeholderData: keepPreviousData,
  });
};
