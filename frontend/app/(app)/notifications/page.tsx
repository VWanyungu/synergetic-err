"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, Bell, CircleCheck, CircleX, LoaderCircle, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/risk-detail/ui";
import { useNotificationActions, useNotifications, type Notification } from "@/hooks/queries/use-notifications";
import { cn } from "@/lib/utils";

const META: Record<Notification["type"], { icon: LucideIcon; tile: string }> = {
  archive_request: { icon: Archive, tile: "bg-warning-bg text-warning-fg" },
  archive_approved: { icon: CircleCheck, tile: "bg-success-bg text-success-fg" },
  archive_rejected: { icon: CircleX, tile: "bg-danger-bg text-danger-fg" },
};

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86_400_000);
  return sameDay(d, now) ? "Today" : sameDay(d, yesterday) ? "Yesterday" : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

function Card({ n }: { n: Notification }) {
  const { read, decide } = useNotificationActions();
  const meta = META[n.type];
  const unread = !n.readAt;
  const act = (outcome: "approve" | "reject") =>
    decide.mutate({ requestId: n.requestId!, outcome }, { onSuccess: () => toast.success(outcome === "approve" ? "Risk archived" : "Request rejected"), onError: (e) => toast.error(e.message) });

  return (
    <div
      onClick={unread ? () => read.mutate(n.id) : undefined}
      className={cn("flex items-start gap-3 rounded-xl border border-line bg-surface p-4", unread && "cursor-pointer")}
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", meta.tile)}>
        <meta.icon className="size-[18px]" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[15px] font-semibold leading-[1.4]">
            {unread && <span className="size-1.5 rounded-full bg-brand" aria-label="Unread" />}
            {n.title}
          </p>
          <span className="whitespace-nowrap text-[13px] text-ink-muted">{timeLabel(n.createdAt)}</span>
        </div>
        <p className="text-[14px] leading-normal text-ink-muted">{n.body}</p>

        {n.type === "archive_request" && n.requestStatus && (
          <div className="flex flex-wrap items-center gap-3">
            {n.requestStatus === "pending" ? (
              <>
                <button type="button" disabled={decide.isPending} onClick={(e) => { e.stopPropagation(); act("approve"); }} className="btn-primary btn-auto !py-1.5 !text-[14px]">
                  {decide.isPending && <LoaderCircle className="size-3.5 animate-spin" />}
                  Accept
                </button>
                <button type="button" disabled={decide.isPending} onClick={(e) => { e.stopPropagation(); act("reject"); }} className="btn-secondary btn-auto !py-1.5 !text-[14px]">
                  Reject
                </button>
              </>
            ) : (
              <span className={cn("flex h-[22px] items-center rounded-full px-2 text-[13px]", n.requestStatus === "approved" ? "bg-success-bg text-success-fg" : "bg-danger-bg text-danger-fg")}>
                {n.requestStatus === "approved" ? "Accepted" : "Rejected"}{n.decidedBy ? ` by ${n.decidedBy}` : ""}
              </span>
            )}
            {n.riskId && <Link href={`/risks/${n.riskId}`} onClick={(e) => e.stopPropagation()} className="text-[14px] font-medium text-brand hover:underline">View risk</Link>}
          </div>
        )}
        {n.type !== "archive_request" && n.riskId && n.requestStatus !== "approved" && (
          <Link href={`/risks/${n.riskId}`} onClick={(e) => e.stopPropagation()} className="w-max text-[14px] font-medium text-brand hover:underline">View risk</Link>
        )}
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const [tab, setTab] = useState<"all" | "unread">("all");
  const list = useNotifications(tab);
  const { readAll } = useNotificationActions();
  const items = list.data?.notifications ?? [];
  const unread = list.data?.unreadCount ?? 0;

  const groups = new Map<string, Notification[]>();
  for (const n of items) groups.set(dayLabel(n.createdAt), [...(groups.get(dayLabel(n.createdAt)) ?? []), n]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.96px]">Notifications</h1>
        <button type="button" onClick={() => readAll.mutate()} disabled={readAll.isPending || unread === 0} className="flex cursor-pointer items-center gap-1.5 text-[14px] font-medium text-brand disabled:cursor-not-allowed disabled:opacity-40">
          {readAll.isPending && <LoaderCircle className="size-3.5 animate-spin" />}
          Mark all as read
        </button>
      </header>

      <div className="-mt-2 flex gap-6 border-b border-line" role="tablist">
        {([["all", "All"], ["unread", `Unread${unread ? ` ${unread}` : ""}`]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn("-mb-px cursor-pointer border-b-2 pb-2 text-[14px] font-medium transition-colors duration-300", tab === id ? "border-brand text-brand" : "border-transparent text-ink-muted hover:text-ink")}
          >
            {label}
          </button>
        ))}
      </div>

      {list.isError ? (
        <p className="text-[14px] text-danger-fg">{list.error.message}</p>
      ) : !list.data ? (
        <div aria-busy="true" aria-label="Loading notifications" className="flex flex-col gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[96px] rounded-xl" />)}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <Bell className="size-8 text-ink-muted" strokeWidth={1.5} aria-hidden />
          <p className="text-[15px] font-medium">{tab === "unread" ? "You're all caught up" : "No notifications yet"}</p>
          <p className="text-[14px] text-ink-muted">{tab === "unread" ? "Nothing is unread right now." : "Archive requests and their outcomes show up here."}</p>
        </div>
      ) : (
        [...groups].map(([label, rows]) => (
          <section key={label} className="flex flex-col gap-3">
            <h2 className="text-[16px] font-semibold leading-[1.4] tracking-[-0.16px]">{label}</h2>
            {rows.map((n) => <Card key={n.id} n={n} />)}
          </section>
        ))
      )}
    </div>
  );
}
