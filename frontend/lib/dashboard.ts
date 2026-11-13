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
  top: RegisterRisk[];
}
