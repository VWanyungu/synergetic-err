"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert } from "@/components/auth/auth-ui";
import { Activity } from "@/components/risk-detail/activity";
import { ArchiveRequestBar } from "@/components/risk-detail/archive-request-bar";
import { AnalyticsTab } from "@/components/risk-detail/analytics-tab";
import { Composer } from "@/components/risk-detail/composer";
import { RiskDialog, type DialogKind } from "@/components/risk-detail/dialogs";
import { RiskHeader, type Tab } from "@/components/risk-detail/header";
import { PlansTab } from "@/components/risk-detail/plans-tab";
import { Sidebar } from "@/components/risk-detail/sidebar";
import { Skeleton } from "@/components/risk-detail/ui";
import { useActivity, useRiskDetail } from "@/hooks/queries/use-risk-detail";
import { useAuth } from "@/contexts/auth-context";
import { ApiError } from "@/lib/api-client";
import { fmtDate } from "@/lib/risk-detail";

function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading risk" className="flex flex-col gap-4">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-8 w-80" />
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_296px]">
        <div className="flex flex-col gap-4"><Skeleton className="h-28" /><Skeleton className="h-10 w-2/3" /><Skeleton className="h-24" /><Skeleton className="h-10 w-1/2" /><Skeleton className="h-24" /></div>
        <div className="flex flex-col gap-4"><Skeleton className="size-[200px] self-center rounded-full" /><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      </div>
    </div>
  );
}

export default function RiskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { userId } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const risk = useRiskDetail(id);
  const activity = useActivity(id);

  if (risk.isPending) return <PageSkeleton />;
  if (risk.isError) {
    const missing = risk.error instanceof ApiError && (risk.error.status === 404 || risk.error.status === 400);
    return (
      <div className="flex flex-col items-start gap-4">
        <Alert variant="error" title={missing ? "We couldn’t find this risk" : "Could not load this risk"}>
          {missing ? "It may have been removed, or the link is wrong." : risk.error.message}
        </Alert>
        <div className="flex gap-3">
          {!missing && <button type="button" className="btn-secondary btn-auto" onClick={() => risk.refetch()}>Try again</button>}
          <Link href="/risks" className="btn-primary btn-auto">Back to the register</Link>
        </div>
      </div>
    );
  }

  const r = risk.data;
  return (
    <div className="flex flex-col gap-6">
      <RiskHeader risk={r} tab={tab} onTab={setTab} banner={<ArchiveRequestBar risk={r} />} />

      {tab === "analytics" ? (
        <AnalyticsTab riskId={r.id} />
      ) : (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_296px]">
          <div className="flex min-w-0 flex-col gap-4">
            {r.transfer && !r.can.edit && (
              <Alert variant="info" title={`This risk now belongs to ${r.department.name}`}>
                It was transferred on {fmtDate(r.transfer.at)}. You can still read it and its history and add comments, but only {r.department.name} can edit it.
              </Alert>
            )}
            {tab === "overview" ? (
              <>
                <Activity risk={r} items={activity.data} loading={activity.isPending} userId={userId} />
                {activity.isError && <p className="text-[14px] text-danger-fg">{activity.error.message}</p>}
                <Composer risk={r} onClose={() => setDialog("close")} onReopen={() => setDialog("reopen")} />
              </>
            ) : (
              <PlansTab risk={r} />
            )}
          </div>
          <Sidebar risk={r} onDialog={setDialog} />
        </div>
      )}

      {dialog && (
        <RiskDialog kind={dialog} risk={r} onClose={() => setDialog(null)} onDone={() => setDialog(null)} />
      )}
    </div>
  );
}
