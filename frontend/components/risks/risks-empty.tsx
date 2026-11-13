import Link from "next/link";
import { Plus } from "lucide-react";

const CARD = "absolute rounded-2xl border border-line bg-surface shadow-[0_6px_24px_rgba(0,0,0,0.06)]";
const BAR = "rounded-md bg-field";

export function RisksEmpty() {
  return (
    <div className="flex flex-col items-center gap-6 py-12">
      <div aria-hidden className="relative h-[190px] w-[440px] max-w-full">
        <div className={`${CARD} left-[70px] top-0 h-[90px] w-[300px] -rotate-[-3deg] p-3`}>
          <div className="flex gap-3">
            <div className={`${BAR} size-10`} />
            <div className="flex flex-1 flex-col gap-2">
              <div className={`${BAR} h-4`} />
              <div className={`${BAR} h-3 w-2/3`} />
            </div>
          </div>
        </div>
        <div className={`${CARD} right-0 top-[40px] h-[130px] w-[210px] rotate-[6deg] p-3`}>
          <div className={`${BAR} ml-auto h-5 w-14`} />
          <div className={`${BAR} mt-8 h-3`} />
          <div className={`${BAR} mt-2 h-7`} />
        </div>
        <div className={`${CARD} bottom-0 left-0 z-10 h-[110px] w-[320px] -rotate-[3deg] p-3`}>
          <div className="flex gap-3">
            <div className={`${BAR} h-[85px] w-[80px]`} />
            <div className="flex flex-1 flex-col gap-2">
              <div className={`${BAR} ml-auto h-4 w-14`} />
              <div className={`${BAR} h-4`} />
              <div className={`${BAR} h-7`} />
            </div>
          </div>
        </div>
      </div>
      <p className="text-[15px] text-placeholder">How about creating a risk right now?</p>
      <Link href="/risks/new" className="btn-primary btn-auto">
        <Plus className="size-[18px]" strokeWidth={2.5} />
        Add risk
      </Link>
    </div>
  );
}

export function RisksSkeleton() {
  return (
    <ul aria-busy="true" aria-label="Loading risks">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="flex animate-pulse items-center gap-3 border-b border-line px-3 py-3.5">
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-3.5 w-2/3 rounded bg-field" />
            <div className="h-3 w-1/3 rounded bg-field" />
          </div>
          <div className="hidden h-3.5 w-[130px] rounded bg-field sm:block" />
          <div className="h-4 w-6 rounded bg-field" />
          <div className="size-3.5 rounded bg-field" />
        </li>
      ))}
    </ul>
  );
}
