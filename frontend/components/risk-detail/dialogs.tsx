"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/auth/auth-ui";
import { SelectField } from "@/components/risk-form/fields";
import { Modal } from "@/components/risk-detail/ui";
import { useRiskCommand } from "@/hooks/queries/use-risk-detail";
import { useDepartments } from "@/hooks/queries/use-risks";
import type { RiskDetail } from "@/lib/risk-detail";

export type DialogKind = "transfer" | "close" | "reopen" | "archive" | "unarchive";

function Footer({ onCancel, action, busy, disabled, onConfirm }: { onCancel: () => void; action: string; busy: boolean; disabled?: boolean; onConfirm: () => void }) {
  return (
    <div className="mt-2 flex justify-end gap-3 border-t border-line px-6 py-4">
      <button type="button" className="btn-secondary btn-auto" onClick={onCancel} disabled={busy}>Cancel</button>
      <button type="button" className="btn-primary btn-auto" onClick={onConfirm} disabled={busy || disabled}>
        {busy && <Spinner />}
        {action}
      </button>
    </div>
  );
}

const Body = ({ children }: { children: React.ReactNode }) => <div className="flex flex-col gap-4 px-6 text-[15px] leading-[1.6] text-ink-muted">{children}</div>;

export function RiskDialog({ kind, risk, onClose, onDone }: { kind: DialogKind; risk: RiskDetail; onClose: () => void; onDone: (kind: DialogKind, requested: boolean) => void }) {
  const [target, setTarget] = useState("");
  const departments = useDepartments();
  const command = useRiskCommand(risk.id, kind);
  const run = () =>
    command.mutate(kind === "transfer" ? { departmentId: target } : undefined, {
      onSuccess: (data) => {
        // A champion's archive is only a request until a Risk Officer accepts it.
        const requested = !!(data as { requested?: boolean } | null)?.requested;
        toast.success(requested ? "Archive requested. A Risk Officer will decide." : { transfer: "Risk transferred", close: "Risk closed", reopen: "Risk opened", archive: "Risk archived", unarchive: "Risk unarchived" }[kind]);
        onDone(kind, requested);
      },
      onError: (e) => toast.error(e.message),
    });
  const common = { onCancel: onClose, busy: command.isPending, onConfirm: run };

  if (kind === "transfer")
    return (
      <Modal title={`Transfer ${risk.code}`} onClose={onClose}>
        <Body>
          <p>Choose the department that will own this risk. Once transferred, only that department can edit it. You can still read it and comment.</p>
          <SelectField label="New department" value={target} items={(departments.data ?? []).filter((d) => d.id !== risk.department.id)} onChange={setTarget} placeholder="Select a department" emptyText="No other departments" />
        </Body>
        <Footer {...common} action="Transfer risk" disabled={!target} />
      </Modal>
    );
  if (kind === "close")
    return (
      <Modal title={`Close ${risk.code}?`} onClose={onClose}>
        <Body><p>The risk will show as Inactive in the register and its risk response will be set to Accept. Its mitigation plans keep their current status, and you can open it again at any time.</p></Body>
        <Footer {...common} action="Close risk" />
      </Modal>
    );
  if (kind === "unarchive")
    return (
      <Modal title={`Unarchive ${risk.code}?`} onClose={onClose}>
        <Body><p>The risk comes back into the register and the risk distribution, with its history and mitigation plans as they were.</p></Body>
        <Footer {...common} action="Unarchive risk" />
      </Modal>
    );
  if (kind === "reopen")
    return (
      <Modal title={`Open ${risk.code}?`} onClose={onClose}>
        <Body><p>The risk will show as Active again and count towards the register and the heatmap. Its risk response stays as it is.</p></Body>
        <Footer {...common} action="Open risk" />
      </Modal>
    );
  return (
    <Modal title={risk.can.archiveDirect ? `Archive ${risk.code}?` : `Request to archive ${risk.code}?`} onClose={onClose}>
      <Body>
        {risk.can.archiveDirect ? (
          <p>The risk leaves the register and the risk distribution. You will find it under the “Archived risks” filter in the register.</p>
        ) : (
          <p>Only a Risk Officer can archive a risk. They will be notified, and the risk stays in the register until they accept your request.</p>
        )}
      </Body>
      <Footer {...common} action={risk.can.archiveDirect ? "Archive risk" : "Send request"} />
    </Modal>
  );
}
