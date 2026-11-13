import { useState } from "react";
import type { Risk } from "@/lib/risk";
import { Row } from "@/components/risk-register/risk-table";
import { RisksEmpty, RisksSkeleton } from "@/components/risks/risks-empty";
import { Pagination } from "@/components/ui/pagination";

const PER_PAGE = 10;

/** The heat map's risk list. Rows expand in place, exactly as they do in the register. */
export function RiskList({ risks, loading }: { risks: Risk[]; loading: boolean }) {
  const [requested, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  // Filters shrink the list; clamp instead of resetting in an effect.
  const page = Math.min(requested, Math.max(Math.ceil(risks.length / PER_PAGE), 1));
  const pageRisks = risks.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  return (
    <div className="min-w-0 flex-1">
      {loading ? (
        <RisksSkeleton />
      ) : risks.length === 0 ? (
        <RisksEmpty />
      ) : (
        <>
          <p className="h-5 pb-1 text-[13px] leading-normal text-ink-muted">
            Showing {risks.length} {risks.length === 1 ? "risk" : "risks"}
          </p>
          {pageRisks.map((r) => (
            <Row key={r.id} risk={r} compact expanded={expanded === r.id} onToggle={() => setExpanded(expanded === r.id ? null : r.id)} />
          ))}
        </>
      )}
      <Pagination page={page} perPage={PER_PAGE} total={risks.length} label="risks" onPageChange={setPage} />
    </div>
  );
}
