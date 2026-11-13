export type RiskLevel = "Low" | "Medium" | "High";


export interface Department {
  id: string;
  name: string;
}

/** BR-01: Low 1–8, Medium 9–14, High 15–25. The one place rating bands are defined. */
export function riskLevel(rating: number): RiskLevel {
  if (rating >= 15) return "High";
  if (rating >= 9) return "Medium";
  return "Low";
}

export const LEVEL_TEXT: Record<RiskLevel, string> = {
  Low: "text-success-fg",
  Medium: "text-warning-fg",
  High: "text-danger-fg",
};

export type RiskStatus = "open" | "in_progress" | "closed";
export type QuickFilter =
  | "highRisk"
  | "noMitigation"
  | "dueForReview"
  | "unassigned"
  | "overdueActions"
  | "myRisks"
  | "changedThisWeek"
  | "archived";
export type RatingBand = "high" | "medium" | "low";

export interface RegisterRisk {
  id: string;
  code: string;
  title: string;
  category: string;
  likelihood: number;
  impact: number;
  rating: number;
  status: RiskStatus;
  riskResponse: "mitigate" | "accept" | "transfer" | "avoid";
  lastReviewedAt: string | null;
  archivedAt: string | null;
  departmentId: string;
  department: string;
  owner: string | null;
}

export interface RegisterData {
  items: RegisterRisk[];
  total: number;
  page: number;
  perPage: number;
  facets: {
    departments: Record<string, number>;
    ratings: Record<RatingBand, number>;
    categories: string[];
  };
}

export interface MitigationAction {
  id: string;
  title: string;
  status: "not_started" | "in_progress" | "completed";
  dueDate: string | null;
  owner: string | null;
}

/** One department on the All registers page, with its active risks split by rating band. */
export interface RegisterSummary {
  id: string;
  name: string;
  code: string;
  description: string | null;
  total: number;
  high: number;
  medium: number;
  low: number;
}

/** A risk as the heat map and its list see it: the same row the register shows. */
export type Risk = RegisterRisk;
