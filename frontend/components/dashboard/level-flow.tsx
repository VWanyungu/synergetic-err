import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/dashboard/card";
import type { DashboardData } from "@/lib/dashboard";

const W = 360;
const H = 250;
// Source edge and the vertical centre of each label row, taken from the design.
const SRC = { x: 106, top: 69, height: 112 };
const END_X = 244;
const LEVELS = [
  { key: "high", label: "HIGH", fill: "var(--color-red-500)", text: "text-danger-fg" },
  { key: "medium", label: "MEDIUM", fill: "var(--color-amber-500)", text: "text-warning-fg" },
  { key: "low", label: "LOW", fill: "var(--color-green-400)", text: "text-success-fg" },
] as const;
// Vertical centres for the bands that are left, so two or one of them stay balanced around the source.
const CENTRES: Record<number, number[]> = { 3: [44, 125, 206], 2: [84, 166], 1: [125] };

export function LevelFlow({ levels, href, className }: { levels: DashboardData["levels"]; href: string; className?: string }) {
  const { total } = levels;
  // A band with no risks is left out entirely: no ribbon and no label.
  const present = LEVELS.filter((l) => levels[l.key] > 0).map((l, i, all) => ({ ...l, centre: CENTRES[all.length]![i]! }));
  const heights = present.map((l) => (total ? (levels[l.key] / total) * SRC.height : 0));
  const ribbons = present.map((l, i) => {
    const h = heights[i]!;
    const s0 = SRC.top + heights.slice(0, i).reduce((a, b) => a + b, 0);
    const t0 = l.centre - h / 2;
    const mid = (SRC.x + END_X) / 2;
    const d = `M${SRC.x} ${s0} C${mid} ${s0} ${mid} ${t0} ${END_X} ${t0} L${END_X} ${t0 + h} C${mid} ${t0 + h} ${mid} ${s0 + h} ${SRC.x} ${s0 + h} Z`;
    return { ...l, h, t0, d, count: levels[l.key] };
  });
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <Card className={className} coreClassName="justify-between gap-6">
      <h2 className="text-[14px] font-medium leading-[1.4]">Risk level distribution</h2>
      <div className="relative mx-auto w-full max-w-[360px]" style={{ aspectRatio: `${W}/${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" aria-hidden>
          {ribbons.map((r) => r.h > 0 && <path key={r.key} d={r.d} fill={r.fill} />)}
          <rect x={SRC.x - 4} y={SRC.top} width="4" height={SRC.height} rx="2" fill="var(--color-ink)" />
          {ribbons.map((r) => r.h > 0 && <rect key={r.key} x={END_X} y={r.t0} width="4" height={r.h} rx="2" fill={r.fill} />)}
        </svg>
        <div className="absolute left-0 flex flex-col justify-center gap-1 rounded-md bg-field pl-3.5 pr-2" style={{ top: `${(SRC.top / H) * 100}%`, height: `${(SRC.height / H) * 100}%`, width: `${(98 / W) * 100}%` }}>
          <span className="text-[11px] font-medium uppercase leading-[1.3] tracking-[0.66px] text-ink-muted">Total risks</span>
          <span className="text-[44px] font-semibold leading-none tracking-[-1.32px]">{total}</span>
        </div>
        {ribbons.map((r) => (
          <div key={r.key} className="absolute flex -translate-y-1/2 flex-col gap-0.5 whitespace-nowrap" style={{ left: `${(260 / W) * 100}%`, top: `${(r.centre / H) * 100}%` }}>
            <span className={`text-[11px] font-medium uppercase leading-[1.3] tracking-[0.66px] ${r.text}`}>{r.label}</span>
            <span className="text-[14px] font-medium leading-[1.4]">{r.count} {r.count === 1 ? "risk" : "risks"}</span>
            <span className="text-[13px] leading-normal text-ink-muted">{pct(r.count)}% of total</span>
          </div>
        ))}
      </div>
      <Link href={href} className="flex items-center justify-between border-t border-line pt-3 text-[13px] leading-normal text-ink-muted hover:text-ink">
        View details
        <ChevronRight className="size-3 text-ink" aria-hidden />
      </Link>
    </Card>
  );
}
