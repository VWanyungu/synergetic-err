"use client";

import { Fragment, useRef, useState } from "react";
import { Archive, ArrowLeftRight, ChevronDown, CircleCheck, CircleDot, FileText, History, MoreHorizontal, Pencil, RotateCcw, Tag } from "lucide-react";
import { toast } from "sonner";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { useCommentHistory, useDescriptionHistory, useEditComment, usePatchRisk } from "@/hooks/queries/use-risk-detail";
import { TextareaField } from "@/components/risk-form/fields";
import { Avatar, Modal, RoleBadge, SaveCancel, SectionLabel, Skeleton } from "@/components/risk-detail/ui";
import { Markdown } from "@/components/risk-detail/markdown";
import { diffSentences } from "@/components/risk-detail/diff";
import { fmtDate, RESPONSE_LABEL, STATUS_LABEL, type ActivityItem, type HistoryVersion, type RiskDetail } from "@/lib/risk-detail";
import { riskLevel } from "@/lib/risk";
import { cn } from "@/lib/utils";

const SHOWN_CHANGES = 4;
const CARD = "rounded-md bg-subtle px-4 py-3.5";

const b = (t: React.ReactNode) => <strong className="font-semibold text-ink">{t}</strong>;
const old = (t: React.ReactNode) => <span className="line-through">{t}</span>;
const label = (map: Record<string, string>, v: string | number | null) => map[String(v)] ?? String(v ?? "");

/** The sentence after the actor's name, plus the icon, for one change event. */
function describe(e: ActivityItem): { icon: React.ReactNode; text: React.ReactNode } {
  const d = e.data;
  const on = <> on {fmtDate(e.createdAt)}</>;
  switch (e.type) {
    case "rating_changed":
      return { icon: <Pencil />, text: <>changed {d.field === "impact" ? "Impact" : "Likelihood"} from {old(d.from)} to {b(d.to)}. Rating is now {b(`${d.rating}, ${riskLevel(Number(d.rating))}`)}{on}</> };
    case "mitigation_status":
      return { icon: <CircleDot />, text: <>changed mitigation status from {old(label(STATUS_LABEL, d.from))} to {b(label(STATUS_LABEL, d.to))}{on}</> };
    case "mitigation_added":
      return { icon: <CircleDot />, text: <>added the mitigation plan {b(d.plan)}{on}</> };
    case "description_edited":
      return { icon: <Pencil />, text: <>edited the description{on}</> };
    case "title_changed":
      return { icon: <Pencil />, text: <>renamed the risk from {old(d.from)} to {b(d.to)}{on}</> };
    case "category_changed":
      return { icon: <Tag />, text: <>changed the category from {old(d.from)} to {b(d.to)}{on}</> };
    case "response_changed":
      return { icon: <Pencil />, text: <>changed the risk response from {old(label(RESPONSE_LABEL, d.from))} to {b(label(RESPONSE_LABEL, d.to))}{on}</> };
    case "division_added":
      return { icon: <Tag />, text: <>added the division {b(d.name)}{on}</> };
    case "division_removed":
      return { icon: <Tag />, text: <>removed the division {b(d.name)}{on}</> };
    case "owner_changed":
      return { icon: <Pencil />, text: d.from ? <>changed the risk owner from {old(d.from)} to {b(d.to ?? "nobody")}{on}</> : <>assigned the risk to {b(d.to ?? "nobody")}{on}</> };
    case "next_review_changed":
      return { icon: <Pencil />, text: <>{d.to ? <>set the next review to {b(fmtDate(String(d.to)))}</> : <>cleared the next review date</>}{on}</> };
    case "reviewed":
      return { icon: <CircleCheck />, text: <>marked this risk as reviewed{on}</> };
    case "transferred":
      return { icon: <ArrowLeftRight />, text: <>transferred this risk from {old(d.from)} to {b(d.to)}{on}</> };
    case "closed":
      return { icon: <CircleCheck />, text: <>closed this risk{d.reason === "accept" ? <> because its response is {b("Accept")}</> : null}{on}</> };
    case "reopened":
      return { icon: <RotateCcw />, text: <>opened this risk{on}</> };
    case "unarchived":
      return { icon: <Archive />, text: <>unarchived this risk{on}</> };
    case "archived":
      return { icon: <Archive />, text: <>archived this risk{on}</> };
    default:
      return { icon: <Pencil />, text: <>updated this risk{on}</> };
  }
}

function Menu({ trigger, children }: { trigger: (open: boolean, toggle: () => void) => React.ReactNode; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false));
  return (
    <div ref={ref} className="relative" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      {trigger(open, () => setOpen(!open))}
      {open && <div className="absolute right-0 top-full z-20 mt-1.5 min-w-[200px] rounded-xl border border-line bg-surface p-1.5 shadow-[0_8px_28px_rgba(17,17,17,0.12)]">{children(() => setOpen(false))}</div>}
    </div>
  );
}

/** "Edited by X ▾": every saved version of a description or comment; opening one shows what changed. */
function HistoryMenu({ riskId, commentId, text, noun }: { riskId: string; commentId?: string; text: string; noun: string }) {
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false));
  const desc = useDescriptionHistory(riskId, open && !commentId);
  const comm = useCommentHistory(riskId, commentId ?? "", open && !!commentId);
  const q = commentId ? comm : desc;
  const versions: HistoryVersion[] = q.data ?? [];
  const newestFirst = [...versions].map((v, i) => ({ v, i })).reverse();
  const shown = viewing !== null ? versions[viewing] : null;
  const prev = viewing ? versions[viewing - 1] : null;
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} className="flex cursor-pointer items-center gap-1 text-[13px] text-ink-muted hover:text-ink">
        {text}
        <ChevronDown className="size-3.5" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-10 w-[360px] rounded-[18px] border border-line bg-subtle p-[5px] shadow-[0_1px_3px_rgba(17,17,17,0.04),0_8px_24px_rgba(17,17,17,0.05)]">
          <div className="flex flex-col gap-0.5 rounded-[13px] border border-line bg-surface p-1.5">
            <p className="py-1.5 pl-2.5 text-[13px] leading-normal text-ink-muted">{q.isPending ? "Loading…" : `Edited ${Math.max(versions.length - 1, 0)} ${versions.length === 2 ? "time" : "times"}`}</p>
            {q.isError && <p className="px-2.5 py-1.5 text-[13px] text-danger-fg">Could not load the history.</p>}
            {newestFirst.map(({ v, i }) => (
              <button key={v.id} type="button" role="menuitem" onClick={() => { setViewing(i); setOpen(false); }} className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left hover:bg-subtle">
                <Avatar name={v.editor ?? "?"} size="xs" />
                <span className="text-[14px] font-medium leading-[1.4]">{v.editor ?? "Someone"}</span>
                <span className="min-w-0 flex-1 text-[14px] leading-normal text-ink-muted">{i === 0 && versions.length > 1 ? `created ${fmtDate(v.createdAt)}` : fmtDate(v.createdAt)}</span>
                {i === versions.length - 1 && versions.length > 1 && <span className="flex h-[22px] items-center rounded-full bg-brand-bg px-2 text-[11px] font-medium uppercase leading-[1.3] tracking-[0.66px] text-brand-text-muted">Latest</span>}
              </button>
            ))}
          </div>
        </div>
      )}
      {shown && (
        <Modal title="Edit History" width={680} onClose={() => setViewing(null)}>
          <div className="flex items-center gap-2 px-6 py-4">
            <Avatar name={shown.editor ?? "?"} size="xs" />
            <p className="min-w-0 flex-1 text-[14px] leading-normal text-ink-muted"><span className="font-medium text-ink">{shown.editor ?? "Someone"}</span> {prev ? `edited the ${noun}` : `wrote the ${noun}`} on {fmtDate(shown.createdAt)}</p>
            <p className="shrink-0 text-[13px] leading-normal text-ink-muted">Version {(viewing ?? 0) + 1} of {versions.length}</p>
          </div>
          <div className="flex flex-col gap-1 px-6 pb-5">
            {(prev ? diffSentences(prev.body, shown.body) : [{ kind: "same" as const, text: shown.body }]).map((l, i) => (
              <p
                key={i}
                className={cn(
                  "flex items-start gap-3 rounded-md py-1.5 pl-3 pr-4",
                  l.kind === "added" && "border-l-2 border-success-fg bg-success-bg",
                  l.kind === "removed" && "border-l-2 border-red-500 bg-danger-bg",
                )}
              >
                <span aria-hidden className={cn("w-[8px] shrink-0 font-mono text-[13px] leading-normal", l.kind === "added" ? "text-success-fg" : l.kind === "removed" ? "text-red-500" : "text-ink-muted")}>
                  {l.kind === "added" ? "+" : l.kind === "removed" ? "-" : ""}
                </span>
                <span className="sr-only">{l.kind === "added" ? "Added: " : l.kind === "removed" ? "Removed: " : ""}</span>
                <span className="min-w-0 flex-1 text-[15px] leading-[1.6] text-ink">{l.text}</span>
              </p>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function CardHead({ name, role, what, children }: { name: string; role: string | null; what: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px]">
      <Avatar name={name} size="xs" />
      <span className="font-medium">{name}</span>
      <span className="text-ink-muted">{what}</span>
      <span className="ml-auto flex items-center gap-3">
        {children}
        <RoleBadge role={role} />
      </span>
    </div>
  );
}

const ItemMenu = ({ onEdit, what }: { onEdit: () => void; what: string }) => (
  <Menu trigger={(_, toggle) => <button type="button" aria-label="More actions" onClick={toggle} className="flex size-6 cursor-pointer items-center justify-center rounded hover:bg-line"><MoreHorizontal className="size-4" /></button>}>
    {(close) => <button type="button" onClick={() => { close(); onEdit(); }} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[14px] hover:bg-field"><Pencil className="size-3.5" />Edit {what}</button>}
  </Menu>
);

function DescriptionCard({ risk }: { risk: RiskDetail }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(risk.description);
  const patch = usePatchRisk(risk.id);
  const save = () => patch.mutate({ description: text }, { onSuccess: () => { setEditing(false); toast.success("Description updated"); }, onError: (e) => toast.error(e.message) });
  return (
    <section aria-label="Description" className="flex flex-col gap-2">
    <SectionLabel>Description</SectionLabel>
    <div>
      <CardHead name={risk.loggedBy ?? "Someone"} role={risk.loggedByRole} what={<>logged this risk on {fmtDate(risk.loggedAt)}</>}>
        {risk.descriptionEdits > 0 && <HistoryMenu riskId={risk.id} text={`Edited by ${risk.lastEditor ?? "someone"}`} noun="description" />}
        {risk.can.edit && <ItemMenu what="description" onEdit={() => { setText(risk.description); setEditing(true); }} />}
      </CardHead>
      {editing ? (
        <div className="mt-3 flex flex-col gap-2">
          <TextareaField label="Description" value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} />
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-ink-muted">Your edit is saved to the history. The previous version stays viewable.</p>
            <SaveCancel busy={patch.isPending} disabled={!text.trim() || text.trim() === risk.description} onSave={save} onCancel={() => setEditing(false)} />
          </div>
        </div>
      ) : (
        <div className="mt-3">{risk.description ? <Markdown text={risk.description} /> : <p className="text-[15px] text-ink-muted">No description yet.</p>}</div>
      )}
    </div>
    </section>
  );
}

function CommentCard({ item, riskId, mine }: { item: ActivityItem; riskId: string; mine: boolean }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.body ?? "");
  const edit = useEditComment(riskId);
  const save = () => edit.mutate({ commentId: item.id, body: text }, { onSuccess: () => { setEditing(false); toast.success("Comment updated"); }, onError: (e) => toast.error(e.message) });
  const name = item.actor?.name ?? "Someone";
  return (
    <div className={CARD}>
      <CardHead name={name} role={item.actor?.role ?? null} what={<>commented on {fmtDate(item.createdAt)}</>}>
        {item.edited && <HistoryMenu riskId={riskId} commentId={item.id} text={`Edited by ${name}`} noun="comment" />}
        {mine && !editing && <ItemMenu what="comment" onEdit={() => { setText(item.body ?? ""); setEditing(true); }} />}
      </CardHead>
      {editing ? (
        <div className="mt-3 flex flex-col gap-2">
          <TextareaField label="Edit comment" value={text} onChange={(e) => setText(e.target.value)} maxLength={10000} />
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-ink-muted">Your edit is saved to the history. The previous version stays viewable.</p>
            <SaveCancel busy={edit.isPending} disabled={!text.trim() || text.trim() === item.body} onSave={save} onCancel={() => setEditing(false)} />
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <Markdown text={item.body ?? ""} />
          {item.attachments.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {item.attachments.map((a) => (
                <li key={a.id}>
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[13px] hover:bg-field">
                    <FileText className="size-3.5" aria-hidden />
                    {a.name}
                    <span className="text-ink-muted">{a.bytes < 1048576 ? `${Math.max(1, Math.round(a.bytes / 1024))} KB` : `${(a.bytes / 1048576).toFixed(1)} MB`}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Event({ item }: { item: ActivityItem }) {
  const { icon, text } = describe(item);
  const name = item.actor?.name ?? "Someone";
  return (
    <div className="relative flex items-center gap-3 py-1 text-[14px] leading-normal text-ink-muted">
      <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-brand-bg text-ink [&_svg]:size-3.5">{icon}</span>
      <Avatar name={name} size="xs" />
      <p><strong className="font-medium text-ink">{name}</strong> {text}</p>
    </div>
  );
}

/** History of the risk: comments and changes. Collapsed until asked for, and can be minimised again. */
function ActivitySection({ risk, items, loading, userId }: { risk: RiskDetail; items: ActivityItem[] | undefined; loading: boolean; userId: string | null }) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const all = items ?? [];
  const changeItems = all.filter((i) => i.type !== "comment");
  const hidden = showAll ? 0 : Math.max(changeItems.length - SHOWN_CHANGES, 0);
  const hiddenIds = new Set(changeItems.slice(0, hidden).map((c) => c.id));
  const firstHidden = all.findIndex((i) => hiddenIds.has(i.id));

  return (
    <section aria-label="Activity" className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="risk-activity"
        onClick={() => setOpen(!open)}
        className="group flex w-full cursor-pointer items-center gap-3 rounded-md bg-subtle px-4 py-3 text-left transition-colors duration-300 hover:bg-field"
      >
        <History className="size-4 shrink-0 text-ink-muted" aria-hidden />
        <span className="text-[14px] font-medium">Activity</span>
        <span className="ml-auto flex items-center gap-1.5 text-[13px] text-ink-muted">
          {open ? "Minimize" : "Show activity"}
          <ChevronDown className={cn("size-4 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]", open && "rotate-180")} aria-hidden />
        </span>
      </button>

      {open && (
        <div id="risk-activity" className="animate-fade-up px-4">
          {loading ? (
            <div className="flex flex-col gap-3 py-3"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-24" /><Skeleton className="h-8 w-1/2" /></div>
          ) : all.length === 0 ? (
            <p className="px-1 py-4 text-[14px] text-ink-muted">No comments or changes yet.</p>
          ) : (
            <ul className="relative flex flex-col gap-1 py-1 before:absolute before:bottom-2 before:left-4 before:top-2 before:w-px before:bg-line">
              {all.map((i, idx) => (
                <Fragment key={i.id}>
                  {idx === firstHidden && hidden > 0 && (
                    <li className="relative flex items-center gap-3 py-2 text-[14px] text-ink-muted">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface"><History className="size-3.5" /></span>
                      <p>{hidden} earlier {hidden === 1 ? "change" : "changes"} hidden. <button type="button" onClick={() => setShowAll(true)} className="cursor-pointer font-medium text-brand hover:underline">Show all</button></p>
                    </li>
                  )}
                  {hiddenIds.has(i.id) ? null : (
                    <li className="animate-fade-up relative py-1" style={{ "--delay": `${Math.min(idx, 8) * 40}ms` } as React.CSSProperties}>
                      {i.type === "comment" ? <CommentCard item={i} riskId={risk.id} mine={!!userId && i.actor?.id === userId} /> : <Event item={i} />}
                    </li>
                  )}
                </Fragment>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

export function Activity({ risk, items, loading, userId }: { risk: RiskDetail; items: ActivityItem[] | undefined; loading: boolean; userId: string | null }) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DescriptionCard risk={risk} />
      <ActivitySection risk={risk} items={items} loading={loading} userId={userId} />
    </div>
  );
}
