import { Check, Minus, Plus, X } from "lucide-react";
import { riskLevel, LEVEL_TEXT } from "@/lib/risk";

// Geometry read off the Figma gauge (240 × 190): three 16px round-capped arcs on one circle, with gaps between them.
const CX = 120;
const CY = 108;
const R = 92;
// `min`/`max` is the rating span each arc stands for (BR-01 bands, half a point either side).
const BANDS = [
  { from: 139, to: 213.4, min: 0.5, max: 8.5, color: "#3D935C" },
  { from: 229.4, to: 278.2, min: 8.5, max: 14.5, color: "#D9992B" },
  { from: 294.2, to: 401, min: 14.5, max: 25.5, color: "#D44C47" },
];

const at = (deg: number) => {
  const a = (deg * Math.PI) / 180;
  return `${(CX + R * Math.cos(a)).toFixed(2)} ${(CY + R * Math.sin(a)).toFixed(2)}`;
};
const arc = (a0: number, a1: number) => `M ${at(a0)} A ${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${at(a1)}`;

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const btn = "flex size-4 cursor-pointer items-center justify-center rounded-full bg-field text-ink hover:bg-line disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="flex h-5 items-center justify-center gap-2.5">
      <span className="mr-[-3px] text-[14px] leading-none text-ink-muted">{label}</span>
      <button type="button" aria-label={`Decrease ${label}`} disabled={value <= 1} onClick={() => onChange(value - 1)} className={btn}><Minus className="size-2.5" strokeWidth={3} /></button>
      <span className="w-2.5 text-center text-[16px] font-medium leading-none tabular-nums">{value}</span>
      <button type="button" aria-label={`Increase ${label}`} disabled={value >= 5} onClick={() => onChange(value + 1)} className={btn}><Plus className="size-2.5" strokeWidth={3} /></button>
    </div>
  );
}

/** Rating gauge out of 25. Optionally edits impact and likelihood in place, with a tick and a cross along the bottom of the disc. */
export function RatingDial({
  rating,
  edit,
}: {
  rating: number;
  edit?: { impact: number; likelihood: number; onChange: (v: { impact?: number; likelihood?: number }) => void; onSave: () => void; onCancel: () => void; busy?: boolean; unchanged?: boolean };
}) {
  const shown = edit ? edit.impact * edit.likelihood : rating;
  const level = riskLevel(shown);
  const current = BANDS.find((b) => shown <= b.max) ?? BANDS[2]!;
  const knobDeg = current.from + Math.min(Math.max((shown - current.min) / (current.max - current.min), 0), 1) * (current.to - current.from);
  const [kx, ky] = at(knobDeg).split(" ").map(Number) as [number, number];
  const tile = "flex h-full flex-1 cursor-pointer items-center justify-center rounded-t-[5px] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="relative mx-auto h-[190px] w-[240px]" role="img" aria-label={`Risk rating ${shown} out of 25, ${level}`}>
      <svg viewBox="0 0 240 190" className="absolute inset-0 size-full overflow-visible" aria-hidden fill="none" strokeWidth={16} strokeLinecap="round">
        {BANDS.map((b) => (
          <g key={b.from} stroke={b.color}>
            <path d={arc(b.from, b.to)} opacity={0.2} />
            {shown > b.min && <path d={arc(b.from, b === current ? knobDeg : b.to)} />}
          </g>
        ))}
        <circle cx={kx} cy={ky} r={10} fill="var(--color-surface)" stroke={current.color} strokeWidth={4} style={{ filter: "drop-shadow(0 2px 3px rgba(17,17,17,0.16))" }} />
      </svg>
      <div className="absolute left-[42px] top-[30px] size-[156px] overflow-hidden rounded-full border border-line bg-surface shadow-[0_6px_20px_rgba(17,17,17,0.08)]">
        {edit ? (
          <>
            <div className="absolute inset-x-0 top-[28px] flex flex-col gap-2">
              <Stepper label="Impact" value={edit.impact} onChange={(impact) => edit.onChange({ impact })} />
              <Stepper label="Likelihood" value={edit.likelihood} onChange={(likelihood) => edit.onChange({ likelihood })} />
            </div>
            {/* The tiles sit in a circle 4px inside the disc, so their bottom corners follow its curve. */}
            <div className="pointer-events-none absolute inset-1 overflow-hidden rounded-full">
              <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex h-[46px] gap-1">
                <button type="button" aria-label="Save" disabled={edit.busy || edit.unchanged} onClick={edit.onSave} className={`${tile} bg-brand-bg text-brand-text-muted hover:bg-brand-line`}><Check className="size-5" strokeWidth={2.5} /></button>
                <button type="button" aria-label="Cancel" disabled={edit.busy} onClick={edit.onCancel} className={`${tile} bg-field text-ink-muted hover:bg-line`}><X className="size-5" strokeWidth={2.5} /></button>
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-x-0 top-[37px] flex flex-col items-center gap-0.5">
            <span className="text-[44px] font-semibold leading-none tracking-[-1.32px]">{shown}</span>
            <span className="text-[13px] leading-normal text-ink-muted">Out of 25</span>
            <span className={`text-[11px] font-medium uppercase leading-[1.3] tracking-[0.66px] ${LEVEL_TEXT[level]}`}>{level}</span>
          </div>
        )}
      </div>
    </div>
  );
}
