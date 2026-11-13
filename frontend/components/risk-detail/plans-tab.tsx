"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { DateField, SelectField, TextareaField, TextField } from "@/components/risk-form/fields";
import { Avatar, SaveCancel, SectionLabel, Skeleton } from "@/components/risk-detail/ui";
import { useRiskFormOptions } from "@/hooks/queries/use-create-risk";
import { usePlans, useSavePlan } from "@/hooks/queries/use-risk-detail";
import { fmtDate, STATUS_LABEL, type Plan, type PlanStatus, type RiskDetail } from "@/lib/risk-detail";
import { cn } from "@/lib/utils";

// One badge shape for every status, so the row reads the same whatever the state.
const STATUS_STYLE: Record<PlanStatus, string> = {
  not_started: "bg-field text-ink-muted",
  in_progress: "bg-warning-bg text-warning-fg",
  completed: "bg-success-bg text-success-fg",
};
const STATUSES = (Object.keys(STATUS_LABEL) as PlanStatus[]).map((id) => ({ id, name: STATUS_LABEL[id] }));

function PlanForm({ risk, plan, onDone }: { risk: RiskDetail; plan?: Plan; onDone: () => void }) {
  const [title, setTitle] = useState(plan?.title ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [ownerId, setOwnerId] = useState(plan?.ownerId ?? "");
  const [dueDate, setDueDate] = useState(plan?.dueDate?.slice(0, 10) ?? "");
  const [status, setStatus] = useState<PlanStatus>(plan?.status ?? "not_started");
  const [tried, setTried] = useState(false);
  const options = useRiskFormOptions();
  const save = useSavePlan(risk.id);
  const submit = () => {
    setTried(true);
    if (!title.trim()) return;
    save.mutate(
      { planId: plan?.id, body: { title: title.trim(), description: description.trim(), ownerId: ownerId || null, dueDate: dueDate || null, status } },
      { onSuccess: () => { toast.success(plan ? "Mitigation plan updated" : "Mitigation plan added"); onDone(); }, onError: (e) => toast.error(e.message) },
    );
  };
  return (
    <div className="flex flex-col gap-3 rounded-md bg-subtle p-4">
      <TextField label="Plan title *" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} error={tried && !title.trim() ? "Enter a title for this plan." : undefined} autoFocus />
      <TextareaField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />
      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField label="Owner" value={ownerId} items={options.data?.owners ?? []} onChange={setOwnerId} placeholder="Unassigned" emptyText={options.isPending ? "Loading…" : "No users"} />
        <DateField label="Due date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <SelectField label="Status" value={status} items={STATUSES} onChange={(v) => setStatus(v as PlanStatus)} placeholder="Status" emptyText="" />
      </div>
      <div className="flex justify-end"><SaveCancel busy={save.isPending} onSave={submit} onCancel={onDone} /></div>
    </div>
  );
}

function PlanCard({ plan, risk }: { plan: Plan; risk: RiskDetail }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <PlanForm risk={risk} plan={plan} onDone={() => setEditing(false)} />;
  const overdue = plan.dueDate && plan.status !== "completed" && plan.dueDate < new Date().toISOString().slice(0, 10);
  return (
    <article className="flex flex-col gap-4 rounded-md bg-subtle px-6 py-5">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-3">
          <h3 className="min-w-0 flex-1 text-[17px] font-semibold leading-[1.35] tracking-[-0.2px]">{plan.title}</h3>
          <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium leading-[1.5]", STATUS_STYLE[plan.status])}>{STATUS_LABEL[plan.status]}</span>
          {risk.can.edit && (
            <button type="button" aria-label={`Edit ${plan.title}`} onClick={() => setEditing(true)} className="-mr-1.5 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-muted transition-colors duration-300 hover:bg-field hover:text-ink"><Pencil className="size-4" /></button>
          )}
        </div>
        {plan.description && <p className="max-w-[68ch] text-[14px] leading-[1.6] text-ink-muted">{plan.description}</p>}
      </div>
      <dl className="flex flex-wrap gap-x-12 gap-y-3">
        <div className="flex flex-col gap-1.5"><dt><SectionLabel>Owner</SectionLabel></dt><dd className="flex items-center gap-2 text-[14px] font-medium">{plan.owner ? <><Avatar name={plan.owner} size="xs" />{plan.owner}</> : <span className="font-normal text-ink-muted">Unassigned</span>}</dd></div>
        <div className="flex flex-col gap-1.5"><dt><SectionLabel>Due date</SectionLabel></dt><dd className={cn("text-[14px] font-medium", overdue && "text-danger-fg")}>{fmtDate(plan.dueDate)}{overdue && <span className="ml-1.5 font-normal"> · overdue</span>}</dd></div>
        <div className="flex flex-col gap-1.5"><dt><SectionLabel>Last update</SectionLabel></dt><dd className="text-[14px] text-ink-muted">{fmtDate(plan.updatedAt)}</dd></div>
      </dl>
    </article>
  );
}

export function PlansTab({ risk }: { risk: RiskDetail }) {
  const [adding, setAdding] = useState(false);
  const plans = usePlans(risk.id);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {risk.can.edit && !adding && (
        <button type="button" className="btn-secondary btn-auto self-end" onClick={() => setAdding(true)}><Plus className="size-4" />Add mitigation plan</button>
      )}
      {adding && <PlanForm risk={risk} onDone={() => setAdding(false)} />}
      {plans.isPending ? (
        <><Skeleton className="h-36" /><Skeleton className="h-36" /></>
      ) : plans.isError ? (
        <p className="text-[14px] text-danger-fg">{plans.error.message} <button type="button" className="font-medium underline" onClick={() => plans.refetch()}>Try again</button></p>
      ) : plans.data.length === 0 && !adding ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-line-input py-14 text-center">
          <p className="text-[15px] font-medium">No mitigation plans yet</p>
          <p className="max-w-[360px] text-[14px] text-ink-muted">{risk.can.edit ? "Add the actions that will reduce this risk, with an owner and a due date." : "Plans for this risk will appear here."}</p>
        </div>
      ) : (
        plans.data.map((p) => <PlanCard key={p.id} plan={p} risk={risk} />)
      )}
    </div>
  );
}
