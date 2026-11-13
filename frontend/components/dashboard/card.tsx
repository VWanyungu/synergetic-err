import { cn } from "@/lib/utils";

/** Figma's nested card: a subtle tray holding a white core. */
export function Card({ children, className, coreClassName }: { children: React.ReactNode; className?: string; coreClassName?: string }) {
  return (
    <div className={cn("flex flex-col rounded-xl border border-line bg-subtle p-1", className)}>
      <div className={cn("flex flex-1 flex-col rounded-lg border border-line bg-surface px-6 py-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]", coreClassName)}>{children}</div>
    </div>
  );
}

export const OVERLINE = "text-[11px] font-medium uppercase leading-[1.3] tracking-[0.66px] text-ink-muted";
