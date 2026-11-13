import { cn } from "@/lib/utils";
import { riskLevel, type Risk, type RiskLevel } from "@/lib/risk";

export interface Cell {
  likelihood: number;
  impact: number;
}

const SCALE = [1, 2, 3, 4, 5];
// A tile is a white card on a tinted tray; the tray's top edge is the lip that carries the risk count.
const LEVEL_STYLE: Record<RiskLevel, string> = {
  Low: "bg-success-bg text-success-fg data-[active=true]:border-success-fg/50",
  Medium: "bg-warning-bg text-warning-fg data-[active=true]:border-warning-fg/50",
  High: "bg-danger-bg text-danger-fg data-[active=true]:border-danger-fg/50",
};
const AXIS = "text-[11px] font-medium uppercase leading-[1.3] tracking-[0.66px] text-ink-muted";

/** 5×5 Likelihood × Impact grid; a cell's colour comes from the BR-01 band of its rating. */
export function HeatMap({
  risks,
  selected,
  onSelect,
  highlight,
}: {
  risks: Risk[];
  selected: Cell | null;
  onSelect: (cell: Cell | null) => void;
  /** Cells it matches (and that hold risks) take the same active look as the selected cell. */
  highlight?: (cell: Cell) => boolean;
}) {
  const count = (c: Cell) => risks.filter((r) => r.likelihood === c.likelihood && r.impact === c.impact).length;

  return (
    <div className="flex shrink-0 gap-3 self-start">
      <p className={cn(AXIS, "rotate-180 self-center")} style={{ writingMode: "vertical-rl" }}>
        Impact
      </p>
      <div className="flex flex-col gap-1">
        {[...SCALE].reverse().map((impact) => (
          <div key={impact} className="flex items-center gap-1">
            <span className="w-5 text-[13px] font-medium leading-[1.4] text-ink-muted">{impact}</span>
            {SCALE.map((likelihood) => {
              const cell = { likelihood, impact };
              const n = count(cell);
              const isSelected = selected?.likelihood === likelihood && selected.impact === impact;
              const lit = highlight?.(cell);
              return (
                <button
                  key={likelihood}
                  type="button"
                  disabled={n === 0}
                  onClick={() => onSelect(isSelected ? null : cell)}
                  aria-pressed={isSelected}
                  // Active is the one existing look: the selected cell, or any occupied cell in the chosen rating.
                  data-active={isSelected || (!!lit && n > 0)}
                  aria-label={`Likelihood ${likelihood}, impact ${impact}, rating ${likelihood * impact}: ${n} ${n === 1 ? "risk" : "risks"}`}
                  className={cn(
                    "group flex h-[62px] w-[56px] flex-col overflow-hidden rounded-lg border-2 transition-[transform,border-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                    // Empty cells recede to a bare outline; only cells holding risks are coloured.
                    n === 0 ? "items-center justify-center border-line bg-transparent" : cn("border-transparent cursor-pointer hover:-translate-y-0.5 active:scale-[0.98]", LEVEL_STYLE[riskLevel(likelihood * impact)]),
                  )}
                >
                  {n === 0 ? (
                    <span className="text-[15px] font-medium leading-none text-placeholder/60">{likelihood * impact}</span>
                  ) : (
                    <>
                      {/* The lip: how many risks sit in this cell. */}
                      <span className="flex h-[16px] shrink-0 items-center justify-center text-[9px] font-medium uppercase leading-none tracking-[0.4px]">
                        {n} {n === 1 ? "risk" : "risks"}
                      </span>
                      {/* The card: the cell's rating (likelihood × impact), with the sum underneath. */}
                      <span className="mx-px mb-px flex flex-1 flex-col items-center justify-center gap-0.5 rounded-[6px] bg-surface shadow-[0_1px_2px_rgba(17,17,17,0.08)]">
                        <span className="text-[18px] font-semibold leading-none tracking-[-0.4px]">{likelihood * impact}</span>
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
        <div className="flex gap-1">
          <span className="w-5" />
          {SCALE.map((l) => (
            <span key={l} className="w-[56px] text-center text-[13px] font-medium leading-[1.4] text-ink-muted">
              {l}
            </span>
          ))}
        </div>
        <p className={cn(AXIS, "mt-2 pl-6 text-center")}>Likelihood</p>
      </div>
    </div>
  );
}
