"use client";

import Link from "next/link";
import { ArrowUpRight, Briefcase, Cog, Construction, Landmark, Layers, FolderKanban, RadioTower, Scale, Server, Zap, type LucideIcon } from "lucide-react";
import type { RegisterSummary } from "@/lib/risk";
import { cn } from "@/lib/utils";

export const ICONS: Record<string, LucideIcon> = {
  LG: Scale,
  PR: FolderKanban,
  IT: Server,
  DM: Landmark,
  ME: Cog,
  CV: Construction,
  EL: Zap,
  TL: RadioTower,
  CS: Briefcase,
};

/** Every row on this page, with the all-departments row first. */
export type Kind = "department" | "division";
const hrefFor = (kind: Kind, id: string) => (kind === "division" ? `/risks/division/${id}` : `/risks/register/${id}`);

export function withTotals(registers: RegisterSummary[], kind: Kind = "department"): (RegisterSummary & { href: string; icon: LucideIcon })[] {
  // A user limited to one department has no enterprise row: their department takes that place.
  if (registers.length === 1 || kind === "division") return registers.map((r) => ({ ...r, href: hrefFor(kind, r.id), icon: ICONS[r.code] ?? Layers }));
  const sum = (k: "total" | "high" | "medium" | "low") => registers.reduce((n, r) => n + r[k], 0);
  const all: RegisterSummary = {
    id: "all",
    name: "All departments",
    code: "ALL",
    description: `The full register across all ${registers.length === 9 ? "nine" : registers.length} departments.`,
    total: sum("total"),
    high: sum("high"),
    medium: sum("medium"),
    low: sum("low"),
  };
  return [all, ...registers].map((r) => ({ ...r, href: hrefFor(kind, r.id), icon: ICONS[r.code] ?? Layers }));
}

/** Quiet by default so ten of them do not shout; the hovered card is the one that turns green. */
function ArrowButton() {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-field text-ink transition-colors duration-300 group-hover:bg-brand group-hover:text-white">
      <ArrowUpRight className="size-4 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-px group-hover:-translate-y-px" aria-hidden />
      <span className="sr-only">Open register</span>
    </span>
  );
}

function Meta({ r }: { r: RegisterSummary }) {
  return <span className="text-[13px] font-medium leading-normal">{r.total} {r.total === 1 ? "risk" : "risks"}</span>;
}

const noun = (kind: Kind) => (kind === "division" ? "division" : "register");
const describe = (r: RegisterSummary, kind: Kind) => r.description ?? (kind === "division" ? `Risks from across the business that affect ${r.name}.` : "");

export function RegisterCards({ registers, kind = "department" }: { registers: RegisterSummary[]; kind?: Kind }) {
  const rows = withTotals(registers, kind);
  const single = registers.length === 1;
  // Divisions have no enterprise-wide card: only a user limited to one division gets the large card.
  const featured = kind === "department" || single ? rows[0]! : null;
  const rest = featured ? rows.slice(1) : rows;
  return (
    <div className="flex flex-col gap-1 rounded-[32px] bg-brand-line p-1">
      {featured && <Link
        href={featured.href}
        className="group flex flex-col gap-10 rounded-[28px] bg-surface p-7 outline-offset-2 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.995]"
      >
        <span className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase leading-normal tracking-[0.66px] text-placeholder">{kind === "division" ? "Division register" : single ? "Department register" : "Enterprise register"}</span>
          <ArrowButton />
        </span>
        <span className="flex min-w-0 flex-col gap-2">
          <span className="text-[28px] font-semibold leading-[1.15] tracking-[-0.84px]">{single ? `${featured.name} ${noun(kind)}` : featured.name}</span>
          <span className="text-[14px] leading-normal text-ink-muted">{describe(featured, kind)}</span>
          <span className="pt-2"><Meta r={featured} /></span>
        </span>
      </Link>}
      {rest.length > 0 && <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((r) => (
          <Link
            key={r.id}
            href={r.href}
            className="group flex min-h-[252px] flex-col justify-between rounded-[28px] bg-surface p-6 outline-offset-2 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.99]"
          >
            <span className="flex items-start justify-between">
              <r.icon className="size-10 text-ink transition-colors duration-300 group-hover:text-brand" strokeWidth={1.5} aria-hidden />
              <ArrowButton />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-[17px] font-semibold leading-[1.3] tracking-[-0.2px]">{r.name} {noun(kind)}</span>
              <span className="text-[14px] leading-normal text-ink-muted">{describe(r, kind)}</span>
              <span className="pt-4"><Meta r={r} /></span>
            </span>
          </Link>
        ))}
      </div>}
    </div>
  );
}

const ROW = "grid grid-cols-[minmax(0,1fr)_32px] items-center gap-4 px-6";

export function RegisterTable({ registers, kind = "department" }: { registers: RegisterSummary[]; kind?: Kind }) {
  const rows = withTotals(registers, kind);
  const hasAll = kind === "department" && registers.length > 1;
  return (
    <>
      <div className="overflow-x-auto border-y border-brand-line bg-surface">
        <div className="min-w-[420px]">
          {rows.map((r, i) => (
            <Link
              key={r.id}
              href={r.href}
              className={cn(
                ROW,
                "group border-b border-brand-line py-4 last:border-b-0 hover:bg-subtle",
                i === 0 && hasAll && "bg-brand-bg hover:bg-brand-bg",
              )}
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[15px] font-medium leading-[1.6]">{i === 0 && hasAll ? r.name : `${r.name} ${noun(kind)}`}</span>
                <span className="truncate text-[13px] leading-normal text-ink-muted">{describe(r, kind)}</span>
              </span>
              <ArrowButton />
            </Link>
          ))}
        </div>
      </div>
      <p className="text-[13px] leading-normal text-placeholder">
        {registers.length} {kind === "division" ? "division" : "department register"}{registers.length === 1 ? "" : "s"}{hasAll ? ` · ${rows[0]!.total} risks` : ""}
      </p>
    </>
  );
}
