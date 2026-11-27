import type { RegisterRisk } from "@/lib/risk";

export interface BreakdownRow {
  id: string;
  name: string;
  high: number;
  medium: number;
  low: number;
  total: number;
  avg: number;
}

export interface DashboardData {
  firstName: string;
  /** YYYY-MM the numbers are as at. */
  month: string;
  /** Last day of that month, YYYY-MM-DD. */
  lastDay: string;
  /** A Risk Champion only ever sees their own department. */
  scoped: boolean;
  departmentId: string;
  departments: { id: string; name: string }[];
  review: { total: number; reviewed: number; pending: number; due: number };
  coverage: { total: number; withPlan: number; noPlan: number };
  levels: { total: number; high: number; medium: number; low: number };
  breakdown: { department: BreakdownRow[]; category: BreakdownRow[]; division: BreakdownRow[] };
  top: (RegisterRisk & { plans: ReportPlan[] })[];
}

/** The dashboard's cards: everything except the Highest rated risks table, which loads on its own. */
export type DashboardSummary = Omit<DashboardData, "top">;

/** A mitigation plan as it stood at the end of the report month. */
export interface ReportPlan {
  title: string;
  status: "not_started" | "in_progress" | "completed";
  dueDate: string | null;
  owner: string | null;
}

export const PLAN_STATUS: Record<ReportPlan["status"], string> = { not_started: "Not started", in_progress: "In progress", completed: "Complete" };
