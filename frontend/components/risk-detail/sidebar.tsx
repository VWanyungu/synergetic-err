"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, ArrowLeftRight, CircleCheck, Link2, Settings } from "lucide-react";
import { toast } from "sonner";
import { ChipGroup, SelectField } from "@/components/risk-form/fields";
import { Avatar, SaveCancel, SectionLabel } from "@/components/risk-detail/ui";
import { RatingDial } from "@/components/risk-detail/rating-dial";
import type { DialogKind } from "@/components/risk-detail/dialogs";
import { useRiskFormOptions } from "@/hooks/queries/use-create-risk";
import { usePatchRisk, useRiskCommand } from "@/hooks/queries/use-risk-detail";
import { useDepartments } from "@/hooks/queries/use-risks";
import { fmtDate, RESPONSE_LABEL, type RiskDetail } from "@/lib/risk-detail";

type Field = "rating" | "response" | "category" | "divisions" | "owner";

function Block({ title, field, can, editing, onEdit, children, last }: { title: string; field: Field; can: boolean; editing: Field | null; onEdit: (f: Field | null) => void; children: React.ReactNode; last?: boolean }) {
  return (
    <section className={last ? "py-4" : "border-b border-line py-4"}>
      <div className="mb-2 flex items-center justify-between">
        <SectionLabel>{title}</SectionLabel>
        {can && editing !== field && (
          <button type="button" aria-label={`Edit ${title.toLowerCase()}`} onClick={() => onEdit(field)} className="flex size-6 cursor-pointer items-center justify-center rounded text-ink-muted hover:bg-field hover:text-ink">
            <Settings className="size-4" />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

export function Sidebar({ risk, onDialog }: { risk: RiskDetail; onDialog: (k: DialogKind) => void }) {
  const [editing, setEditing] = useState<Field | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const options = useRiskFormOptions();
  const departments = useDepartments();
  const patch = usePatchRisk(risk.id);
  const review = useRiskCommand(risk.id, "review");
  const can = risk.can.edit;

  const open = (f: Field | null) => {
    setEditing(f);
    setDraft({ impact: risk.impact, likelihood: risk.likelihood, riskResponse: risk.riskResponse, category: risk.category, divisionIds: risk.divisions.map((d) => d.id), ownerId: risk.owner?.id ?? "" });
  };
  const save = (body: Record<string, unknown>) =>
    patch.mutate(body, { onSuccess: () => { setEditing(null); toast.success(body.riskResponse === "accept" && risk.status !== "closed" ? "Risk updated and closed, as its response is Accept" : "Risk updated"); }, onError: (e) => toast.error(e.message) });
  const controls = (body: Record<string, unknown>, disabled = false) => (
    <div className="mt-3 flex justify-end"><SaveCancel busy={patch.isPending} disabled={disabled} onSave={() => save(body)} onCancel={() => setEditing(null)} /></div>
  );
  const block = { can, editing, onEdit: open };
  const d = draft as { impact: number; likelihood: number; riskResponse: string; category: string; divisionIds: string[]; ownerId: string };

  return (
    <aside className="flex min-w-0 flex-col" aria-label="Risk details">
      <Block title="Risk rating" field="rating" {...block}>
        {editing === "rating" ? (
          <RatingDial
            rating={risk.rating}
            edit={{
              impact: d.impact,
              likelihood: d.likelihood,
              onChange: (v) => setDraft((prev) => ({ ...prev, ...v })),
              busy: patch.isPending,
              unchanged: d.impact === risk.impact && d.likelihood === risk.likelihood,
              onSave: () => save({ impact: d.impact, likelihood: d.likelihood }),
              onCancel: () => setEditing(null),
            }}
          />
        ) : (
          <RatingDial rating={risk.rating} />
        )}
      </Block>

      <Block title="Risk response" field="response" {...block}>
        {editing === "response" ? (
          <>
            <SelectField label="Risk response" value={d.riskResponse} items={Object.entries(RESPONSE_LABEL).map(([id, name]) => ({ id, name }))} onChange={(v) => setDraft({ ...d, riskResponse: v })} placeholder="Select" emptyText="" />
            {controls({ riskResponse: d.riskResponse }, d.riskResponse === risk.riskResponse)}
          </>
        ) : (
          <p className="text-[14px] font-medium">{RESPONSE_LABEL[risk.riskResponse]}</p>
        )}
      </Block>

      <Block title="Category" field="category" {...block}>
        {editing === "category" ? (
          <>
            <SelectField label="Category" value={d.category} items={(options.data?.categories ?? []).map((c) => ({ id: c, name: c }))} onChange={(v) => setDraft({ ...d, category: v })} placeholder="Select a category" emptyText={options.isPending ? "Loading…" : "No categories"} />
            {controls({ category: d.category }, d.category === risk.category)}
          </>
        ) : (
          <p className="text-[14px] font-medium">{risk.category}</p>
        )}
      </Block>

      <Block title="Affected divisions" field="divisions" {...block}>
        {editing === "divisions" ? (
          <>
            <ChipGroup options={(departments.data ?? []).filter((x) => x.id !== risk.department.id)} value={d.divisionIds} onChange={(v) => setDraft({ ...d, divisionIds: v })} emptyText="No other departments." />
            {controls({ divisionIds: d.divisionIds })}
          </>
        ) : risk.divisions.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {risk.divisions.map((x) => <li key={x.id} className="rounded-full bg-brand-bg px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.5px] text-brand-text-muted">{x.name}</li>)}
          </ul>
        ) : (
          <p className="text-[14px] text-ink-muted">None</p>
        )}
      </Block>

      <Block title="Risk owner" field="owner" {...block}>
        {editing === "owner" ? (
          <>
            <SelectField label="Risk owner" value={d.ownerId} items={options.data?.owners ?? []} onChange={(v) => setDraft({ ...d, ownerId: v })} placeholder="Unassigned" emptyText={options.isPending ? "Loading…" : "No users"} />
            {controls({ ownerId: d.ownerId || null }, d.ownerId === (risk.owner?.id ?? ""))}
          </>
        ) : risk.owner ? (
          <div className="flex items-center gap-3">
            <Avatar name={risk.owner.name} />
            <div className="min-w-0">
              <p className="text-[14px] font-medium leading-[1.4]">{risk.owner.name}</p>
              <p className="text-[13px] leading-normal text-ink-muted">{[risk.owner.role, risk.owner.department].filter(Boolean).join(", ") || "No role"}</p>
            </div>
          </div>
        ) : (
          <p className="text-[14px] text-ink-muted">Unassigned</p>
        )}
      </Block>

      <section className="border-b border-line py-4">
        <SectionLabel>Review</SectionLabel>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] leading-normal text-ink-muted">Last reviewed</span>
            <span className="text-[14px] font-medium leading-[1.4]">{risk.lastReviewedAt ? fmtDate(risk.lastReviewedAt) : "Never"}</span>
          </div>
          {can && (
            <button
              type="button"
              disabled={review.isPending}
              onClick={() => review.mutate(undefined, { onSuccess: () => toast.success("Review logged"), onError: (e) => toast.error(e.message) })}
              className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-field px-3 text-[13px] font-medium transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-line active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CircleCheck className="size-3.5 text-brand" aria-hidden />
              Log review
            </button>
          )}
        </div>
      </section>

      <section className="border-b border-line py-4">
        <SectionLabel>Department</SectionLabel>
        <p className="mt-2 text-[14px] font-medium">{risk.department.name}</p>
      </section>

      <section className="py-4">
        <SectionLabel>Participants</SectionLabel>
        <ul className="mt-2 flex flex-wrap gap-2">
          {risk.participants.map((p) => <li key={p.id}><Avatar name={p.name} /></li>)}
        </ul>
      </section>

      <div className="flex flex-col items-start gap-1 text-[14px]">
        {can && (
          <>
            <button type="button" onClick={() => onDialog("transfer")} className="flex cursor-pointer items-center gap-2 py-1.5 hover:text-brand"><ArrowLeftRight className="size-4" />Transfer risk</button>
            {risk.archived ? (
              <button type="button" onClick={() => onDialog("unarchive")} className="flex cursor-pointer items-center gap-2 py-1.5 hover:text-brand"><ArchiveRestore className="size-4" />Unarchive risk</button>
            ) : (risk.archiveRequest ? (
              <span className="flex items-center gap-2 py-1.5 text-ink-muted"><Archive className="size-4" />Archive requested</span>
            ) : (
              <button type="button" onClick={() => onDialog("archive")} className="flex cursor-pointer items-center gap-2 py-1.5 hover:text-brand"><Archive className="size-4" />{risk.can.archiveDirect ? "Archive risk" : "Request archive"}</button>
            ))}
          </>
        )}
        <button type="button" onClick={() => navigator.clipboard.writeText(window.location.href).then(() => toast.success("Link copied"), () => toast.error("Could not copy the link"))} className="flex cursor-pointer items-center gap-2 py-1.5 hover:text-brand"><Link2 className="size-4" />Copy link</button>
      </div>
    </aside>
  );
}
