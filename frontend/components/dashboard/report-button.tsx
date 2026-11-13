"use client";

import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { monthLabel } from "@/components/risk-register/filter-menus";
import type { DashboardData } from "@/lib/dashboard";

/** Builds the PDF in the browser, only when asked: the renderer is a large dependency, so it is imported on click. */
export function ReportButton({ data, preparedBy }: { data: DashboardData; preparedBy: string }) {
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const [{ pdf }, { DashboardReport }] = await Promise.all([import("@react-pdf/renderer"), import("@/components/dashboard/dashboard-report")]);
      const period = monthLabel(data.month);
      const meta = {
        period,
        scope: data.departmentId ? (data.departments.find((d) => d.id === data.departmentId)?.name ?? "Department") : "All departments",
        preparedBy,
        generatedOn: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      };
      const blob = await pdf(<DashboardReport data={data} meta={meta} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Risk Report - ${meta.scope} - ${period}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("The report could not be created. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      className="flex h-[34px] cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border border-line-input bg-surface px-4 text-[13px] font-medium transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-field active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
    >
      {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
      Download report
    </button>
  );
}
