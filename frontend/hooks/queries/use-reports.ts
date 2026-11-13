import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface ReportMonth {
  /** YYYY-MM */
  month: string;
  /** Risks that existed, not archived, by the end of that month. */
  total: number;
}

export const useReportMonths = () => useQuery({ queryKey: ["report-months"], queryFn: () => api<ReportMonth[]>("/dashboard/months") });
