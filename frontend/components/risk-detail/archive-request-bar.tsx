"use client";

import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { useNotificationActions } from "@/hooks/queries/use-notifications";
import { fmtDate, type RiskDetail } from "@/lib/risk-detail";

/** For Admins and Risk Officers: a champion has asked to archive this risk, and the decision is made right here. */
export function ArchiveRequestBar({ risk }: { risk: RiskDetail }) {
  const { decide } = useNotificationActions();
  const request = risk.archiveRequest;
  if (!request || !risk.can.archiveDirect || risk.archived) return null;

  const act = (outcome: "approve" | "reject") =>
    decide.mutate({ requestId: request.id, outcome }, { onSuccess: () => toast.success(outcome === "approve" ? "Risk archived" : "Request rejected"), onError: (e) => toast.error(e.message) });

  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-subtle py-3 pl-4 pr-3">
      <p className="text-[14px] leading-normal">
        <span className="font-medium">{request.requestedBy ?? "A Risk Champion"}</span> asked to archive this risk on {fmtDate(request.requestedAt)}.
      </p>
      <div className="flex gap-2">
        <button type="button" disabled={decide.isPending} onClick={() => act("approve")} className="btn-primary btn-auto !py-1.5 !text-[14px]">
          {decide.isPending && <LoaderCircle className="size-3.5 animate-spin" />}
          Accept
        </button>
        <button type="button" disabled={decide.isPending} onClick={() => act("reject")} className="btn-secondary btn-auto !py-1.5 !text-[14px]">
          Reject
        </button>
      </div>
    </div>
  );
}
