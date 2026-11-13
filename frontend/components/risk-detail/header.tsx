"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, ChevronRight, CircleCheck, CircleDashed, Archive, Pencil } from "lucide-react";
import { toast } from "sonner";
import { TextField } from "@/components/risk-form/fields";
import { SaveCancel } from "@/components/risk-detail/ui";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { usePatchRisk } from "@/hooks/queries/use-risk-detail";
import { fmtDate, type RiskDetail } from "@/lib/risk-detail";
import { cn } from "@/lib/utils";

export type Tab = "overview" | "plans" | "analytics";

function Pill({ risk }: { risk: RiskDetail }) {
  const [Icon, label, style] = risk.archived
    ? [Archive, "Archived", "border border-line bg-field text-ink-muted"]
    : risk.status === "closed"
      ? [CircleDashed, "Inactive", "border border-line bg-field text-ink-muted"]
      : [CircleCheck, "Active", "bg-success-bg text-success-fg"];
  return (
    <span className={cn("flex shrink-0 items-center gap-1.5 rounded-full py-[5px] pl-2.5 pr-3 text-[14px] font-medium leading-[1.4]", style)}>
      <Icon className="size-4" />
      {label}
    </span>
  );
}

/** The orange Transferred pill; clicking it opens a card listing every transfer of this risk. */
function TransferHistory({ risk }: { risk: RiskDetail }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false));
  return (
    <div ref={ref} className="relative shrink-0" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex cursor-pointer items-center gap-1.5 rounded-full bg-orange-bg py-[5px] pl-2.5 pr-3 text-[14px] font-medium leading-[1.4] text-orange-fg"
      >
        <ArrowLeftRight className="size-4" />
        Transferred
      </button>
      {open && (
        <div role="dialog" aria-label="Transfer history" className="animate-fade-up absolute left-0 top-full z-20 mt-2 w-[340px] rounded-xl border border-line bg-surface p-4 shadow-[0_8px_30px_rgba(17,17,17,0.1)]">
          <p className="text-[11px] font-medium uppercase leading-[1.3] tracking-[0.66px] text-ink-muted">Transfer history</p>
          <ol className="mt-3 flex flex-col gap-3">
            {risk.transfers.map((t, i) => (
              <li key={`${t.at}-${i}`} className="flex flex-col gap-0.5 border-l-2 border-orange-fg/30 pl-3">
                <span className="text-[14px] font-medium leading-[1.4]">
                  {t.from ?? "Unknown"} <span className="text-ink-muted">to</span> {t.to ?? "Unknown"}
                </span>
                <span className="text-[13px] leading-normal text-ink-muted">
                  {t.by ? `by ${t.by}, ` : ""}{fmtDate(t.at)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export function RiskHeader({ risk, tab, onTab, banner }: { risk: RiskDetail; tab: Tab; onTab: (t: Tab) => void; /** Shown between the breadcrumb and the title. */ banner?: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(risk.title);
  const patch = usePatchRisk(risk.id);
  const save = () => patch.mutate({ title }, { onSuccess: () => { setEditing(false); toast.success("Title updated"); }, onError: (e) => toast.error(e.message) });
  const tabs: [Tab, string, number?][] = [["overview", "Overview"], ["plans", "Mitigation plans", risk.planCount], ["analytics", "Analytics"]];

  return (
    <header className="flex flex-col gap-3">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[14px] leading-normal">
        <Link href="/risks" className="text-brand hover:underline">Risk Register</Link>
        <ChevronRight className="size-3 text-ink-muted" aria-hidden />
        <span className="text-ink-muted">{risk.code}</span>
      </nav>

      {banner}

      {editing ? (
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} autoFocus onKeyDown={(e) => e.key === "Enter" && title.trim() && title.trim() !== risk.title && save()} />
      ) : (
        <h1 className="flex flex-wrap items-baseline gap-x-3 text-[32px] font-semibold leading-[1.15] tracking-[-0.96px]">
          <span className="[overflow-wrap:anywhere]">{risk.title}</span>
          <span className="font-light text-ink-muted/70">{risk.code}</span>
          {risk.can.edit && (
            <button type="button" aria-label="Edit title" onClick={() => { setTitle(risk.title); setEditing(true); }} className="cursor-pointer self-center text-ink-muted hover:text-ink"><Pencil className="size-[18px]" /></button>
          )}
        </h1>
      )}

      <div className="flex items-center gap-3">
        <Pill risk={risk} />
        {risk.transfer && <TransferHistory risk={risk} />}
        <p className="min-w-0 flex-1 text-[14px] leading-normal text-ink-muted">
          <span className="font-medium text-ink">{risk.loggedBy ?? "Someone"}</span> logged this risk on {fmtDate(risk.loggedAt)}
          <span aria-hidden> · </span>
          {risk.commentCount} {risk.commentCount === 1 ? "comment" : "comments"}
        </p>
        {editing && <SaveCancel busy={patch.isPending} disabled={!title.trim() || title.trim() === risk.title} onSave={save} onCancel={() => setEditing(false)} />}
      </div>

      <div role="tablist" className="mt-3 flex gap-7 border-b border-line">
        {tabs.map(([id, label, count]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => onTab(id)} className={cn("-mb-px flex cursor-pointer items-center gap-2 border-b-2 py-3 text-[14px] font-medium", tab === id ? "border-brand text-ink" : "border-transparent text-ink-muted hover:text-ink")}>
            {label}
            {count !== undefined && <span className="rounded-full bg-field px-2 py-0.5 text-[12px] leading-none text-ink-muted">{count}</span>}
          </button>
        ))}
      </div>
    </header>
  );
}
