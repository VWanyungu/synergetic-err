"use client";

import { useState } from "react";
import { useAnalytics } from "@/hooks/queries/use-risk-detail";
import { Skeleton } from "@/components/risk-detail/ui";
import { fmtMonth } from "@/lib/risk-detail";
import { LEVEL_TEXT, riskLevel } from "@/lib/risk";
import { cn } from "@/lib/utils";

const W = 1000, H = 300, L = 44, RIGHT = 14, T = 12, B = 30;
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LEVEL_PILL = { Low: "bg-success-bg text-success-fg", Medium: "bg-warning-bg text-warning-fg", High: "bg-danger-bg text-danger-fg" };

const span = (from: string, to: string) => (from === to ? fmtMonth(from) : `${MONTH[Number(from.slice(5, 7)) - 1]} to ${fmtMonth(to)}`);

interface ChartPoint {
  label: string; // x-axis text
  rating: number;
  title: string; // tooltip heading
  text: string; // tooltip line
}

/** `bands` puts each point in the middle of its own slot (years), instead of spreading them edge to edge (months). */
function Chart({ points, bands }: { points: ChartPoint[]; bands?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const x = (i: number) => (bands ? L + ((i + 0.5) * (W - L - RIGHT)) / points.length : L + (points.length === 1 ? (W - L - RIGHT) / 2 : (i * (W - L - RIGHT)) / (points.length - 1)));
  const y = (r: number) => T + (1 - r / 25) * (H - T - B);
  const step = Math.ceil(points.length / 12);
  const h = hover === null ? null : points[hover]!;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Rating over time" onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - box.left) / box.width) * W;
          const f = (px - L) / (W - L - RIGHT);
          setHover(Math.min(points.length - 1, Math.max(0, bands ? Math.floor(f * points.length) : Math.round(f * (points.length - 1)))));
        }}>
        <rect x={L} y={y(25)} width={W - L - RIGHT} height={y(14.5) - y(25)} fill="var(--color-danger-bg)" opacity={0.7} />
        <rect x={L} y={y(14.5)} width={W - L - RIGHT} height={y(8.5) - y(14.5)} fill="var(--color-warning-bg)" opacity={0.7} />
        <rect x={L} y={y(8.5)} width={W - L - RIGHT} height={y(0) - y(8.5)} fill="var(--color-success-bg)" opacity={0.8} />
        {[5, 10, 15, 20, 25].map((g) => (
          <g key={g}>
            <line x1={L} x2={W - RIGHT} y1={y(g)} y2={y(g)} stroke="var(--color-line-input)" strokeDasharray="2 6" />
            <text x={L - 12} y={y(g) + 4} textAnchor="end" fontSize={13} fill="var(--color-ink-muted)">{g}</text>
          </g>
        ))}
        {([["HIGH", 20, "var(--color-danger-fg)"], ["MEDIUM", 12, "var(--color-warning-fg)"], ["LOW", 4, "var(--color-success-fg)"]] as const).map(([t, v, c]) => (
          <text key={t} x={W - RIGHT - 10} y={y(v) + 4} textAnchor="end" fontSize={11} letterSpacing={0.6} fill={c}>{t}</text>
        ))}
        <polyline fill="none" stroke="var(--color-ink)" strokeWidth={1.6} strokeLinejoin="round" points={points.map((p, i) => `${x(i)},${y(p.rating)}`).join(" ")} />
        {points.length <= 24 && points.map((p, i) => <circle key={`dot-${i}`} cx={x(i)} cy={y(p.rating)} r={2.5} fill="var(--color-ink)" />)}
        {points.map((p, i) => i % step === 0 && (
          <text key={p.title} x={x(i)} y={H - 8} textAnchor="middle" fontSize={13} fill={hover === i ? "var(--color-ink)" : "var(--color-ink-muted)"} fontWeight={hover === i ? 600 : 400}>
            {p.label}
          </text>
        ))}
        {hover !== null && h && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--color-disabled)" />
            <circle cx={x(hover)} cy={y(h.rating)} r={8} fill="var(--color-surface)" stroke="var(--color-ink)" strokeWidth={1.6} />
            <circle cx={x(hover)} cy={y(h.rating)} r={3} fill="var(--color-ink)" />
          </g>
        )}
      </svg>
      {h && hover !== null && (
        <div className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md bg-ink px-3 py-2 text-[13px] leading-snug text-white shadow-lg" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <p className="text-white/70">{h.title}</p>
          <p className="font-medium">{h.text}</p>
        </div>
      )}
      <table className="sr-only"><caption>Rating over time</caption><tbody>{points.map((p) => <tr key={p.title}><th>{p.title}</th><td>{p.rating}</td></tr>)}</tbody></table>
    </div>
  );
}

export function AnalyticsTab({ riskId }: { riskId: string }) {
  const [range, setRange] = useState<"year" | "all">("year");
  const q = useAnalytics(riskId, range);
  const pill = "cursor-pointer rounded-full px-4 py-1.5 text-[14px] font-medium";
  const a = q.data;
  // "Last 12 months" compares with the start of the window; "All time" compares this year's average with last year's.
  const yearly = range === "all";
  const thisYear = a?.years.at(-1);
  const lastYear = a?.years.at(-2);
  // The big number is this year's average for "All time", and today's rating for the year-to-date view.
  const headline = yearly ? thisYear?.average : a?.current;
  const level = headline != null ? riskLevel(Math.round(headline)) : null;
  const from = yearly ? lastYear?.average : a?.first?.rating;
  const to = yearly ? thisYear?.average : a?.current;
  const delta = from != null && to != null ? Math.round((to - from) * 10) / 10 : 0;
  const pct = from ? Math.round((delta / from) * 100) : 0;
  const sign = delta > 0 ? "+" : "";
  const chart: ChartPoint[] =
    yearly
      ? (a?.years ?? []).map((y) => ({ label: String(y.year), rating: y.average, title: `${y.year}${y.year === thisYear?.year ? " so far" : ""}`, text: `Average ${y.average}, ${riskLevel(Math.round(y.average))}` }))
      : (a?.points ?? []).map((p) => ({ label: MONTH[Number(p.month.slice(5, 7)) - 1]!, rating: p.rating, title: fmtMonth(p.month), text: `Rating ${p.rating}, ${riskLevel(p.rating)}` }));
  const showDelta = from != null && to != null && (yearly ? !!lastYear : !!a?.first && a.points.length > 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-[15px] text-ink-muted">Risk rating</p>
          {q.isPending ? <Skeleton className="h-14 w-40" /> : a && headline != null && level ? (
            <>
              <p className="flex items-baseline gap-2"><span className="text-[40px] font-semibold leading-none tracking-[-1px]">{headline}</span><span className="text-[15px] text-ink-muted">/ 25</span><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.66px]", LEVEL_PILL[level])}>{level}</span></p>
              {showDelta && <p className="text-[14px]"><span className={cn("font-medium", delta > 0 ? LEVEL_TEXT.High : delta < 0 ? LEVEL_TEXT.Low : "text-ink-muted")}>{sign}{delta} ({sign}{pct}%)</span><span className="text-ink-muted"> · {yearly ? `${thisYear!.year} average vs ${lastYear!.year}` : `since ${fmtMonth(a!.first!.month)}`}</span></p>}
            </>
          ) : null}
        </div>
        <div className="flex gap-2" role="group" aria-label="Range">
          <button type="button" aria-pressed={range === "year"} onClick={() => setRange("year")} className={cn(pill, range === "year" ? "bg-brand text-white" : "border border-line-input bg-surface")}>Last 12 months</button>
          <button type="button" aria-pressed={range === "all"} onClick={() => setRange("all")} className={cn(pill, range === "all" ? "bg-brand text-white" : "border border-line-input bg-surface")}>All time</button>
        </div>
      </div>

      {q.isPending ? <Skeleton className="h-[300px]" /> : q.isError ? (
        <p className="text-[14px] text-danger-fg">{q.error.message} <button type="button" className="font-medium underline" onClick={() => q.refetch()}>Try again</button></p>
      ) : a && a.points.length > 0 ? (
        <>
          <Chart points={chart} bands={yearly} />
          <dl className="grid w-full grid-cols-2 gap-y-6 border-t border-line pt-6 lg:grid-cols-4">
            {[
              ["Highest", a.highest ? String(a.highest.value) : "–", a.highest ? span(a.highest.from, a.highest.to) : ""],
              ["Lowest", a.lowest ? String(a.lowest.value) : "–", a.lowest ? span(a.lowest.from, a.lowest.to) : ""],
              ["Rating changes", String(a.changes), range === "year" ? "so far this year" : "since the first rating"],
              ["Time at high", a.atHigh ? `${a.atHigh.months} ${a.atHigh.months === 1 ? "month" : "months"}` : "Never", a.atHigh ? span(a.atHigh.from, a.atHigh.to) : "Never rated 15 or above"],
            ].map(([k, v, sub]) => (
              <div key={k} className="flex min-w-0 flex-col gap-1 border-l border-line pl-6 max-lg:odd:border-l-0 max-lg:odd:pl-0 lg:first:border-l-0 lg:first:pl-0"><dt className="text-[11px] font-medium uppercase tracking-[0.66px] text-ink-muted">{k}</dt><dd className="text-[22px] font-semibold leading-tight">{v}</dd><dd className="text-[14px] text-ink-muted">{sub}</dd></div>
            ))}
          </dl>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-line-input py-16 text-center">
          <p className="text-[15px] font-medium">No rating history yet</p>
          <p className="max-w-[360px] text-[14px] text-ink-muted">The chart fills in as this risk’s impact or likelihood is changed.</p>
        </div>
      )}
    </div>
  );
}
