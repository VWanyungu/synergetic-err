import type { RiskStatus } from "@/lib/risk";

export interface RiskDetail {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  status: RiskStatus;
  archived: boolean;
  riskResponse: "mitigate" | "accept" | "transfer" | "avoid";
  likelihood: number;
  impact: number;
  rating: number;
  department: { id: string; name: string };
  owner: { id: string; name: string; role: string | null; department: string | null } | null;
  divisions: { id: string; name: string; code: string }[];
  loggedBy: string | null;
  loggedByRole: string | null;
  loggedAt: string;
  lastReviewedAt: string | null;
  nextReviewDate: string | null;
  commentCount: number;
  planCount: number;
  participants: { id: string; name: string }[];
  descriptionEdits: number;
  lastEditor: string | null;
  transfer: { at: string; from: string; to: string } | null;
  /** Every transfer of this risk between departments, newest first. */
  transfers: { at: string; from: string | null; to: string | null; by: string | null }[];
  can: { edit: boolean; /** Admin and Risk Officer archive outright; a Risk Champion has to ask. */ archiveDirect: boolean };
  /** A pending request from a Risk Champion to archive this risk. */
  archiveRequest: { id: string; requestedAt: string; requestedBy: string | null } | null;
}

export interface Attachment {
  id: string;
  name: string;
  mimeType: string | null;
  bytes: number;
  url: string;
}

export interface ActivityItem {
  id: string;
  type: string;
  body: string | null;
  data: Record<string, string | number | null>;
  createdAt: string;
  editedAt: string | null;
  actor: { id: string; name: string; role: string | null } | null;
  attachments: Attachment[];
  edited: boolean;
}

export interface HistoryVersion {
  id: string;
  body: string;
  createdAt: string;
  editor: string | null;
}

export type PlanStatus = "not_started" | "in_progress" | "completed";
export interface Plan {
  id: string;
  title: string;
  description: string | null;
  status: PlanStatus;
  dueDate: string | null;
  updatedAt: string;
  ownerId: string | null;
  owner: string | null;
}

export interface Analytics {
  points: { month: string; rating: number }[];
  years: { year: number; average: number }[];
  current: number | null;
  first: { month: string; rating: number } | null;
  highest: { value: number; from: string; to: string } | null;
  lowest: { value: number; from: string; to: string } | null;
  changes: number;
  atHigh: { months: number; from: string; to: string } | null;
}

export const STATUS_LABEL: Record<PlanStatus, string> = { not_started: "Not started", in_progress: "In progress", completed: "Done" };
export const RESPONSE_LABEL = { mitigate: "Mitigate", accept: "Accept", transfer: "Transfer", avoid: "Avoid" } as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "28 Oct 2026". Date-only strings are read as calendar days; timestamps in the viewer's time zone. */
export function fmtDate(s: string | null | undefined): string {
  if (!s) return "Not set";
  const d = new Date(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
export const fmtMonth = (s: string) => `${MONTHS[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}`;
export const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
