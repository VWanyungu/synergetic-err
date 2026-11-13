import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

const BTN = "flex size-9 items-center justify-center rounded-lg text-[13px] font-medium";

export function Pagination({
  page,
  perPage,
  total,
  label,
  onPageChange,
}: {
  page: number;
  perPage: number;
  total: number;
  label: string;
  onPageChange: (page: number) => void;
}) {
  const last = Math.max(Math.ceil(total / perPage), 1);
  if (last === 1) return null;

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const nav = (target: number, disabled: boolean, aria: string, icon: React.ReactNode) => (
    <button
      type="button"
      aria-label={aria}
      disabled={disabled}
      onClick={() => onPageChange(target)}
      className={cn(BTN, "border border-line bg-surface hover:bg-field disabled:opacity-40 disabled:hover:bg-surface", !disabled && "cursor-pointer")}
    >
      {icon}
    </button>
  );

  return (
    <div className="flex items-center justify-between gap-3 pt-4">
      <span className="text-[13px] text-ink-muted">
        {from}–{to} of {total} {label}
      </span>
      <div className="flex items-center gap-1.5">
        {nav(1, page === 1, "First page", <ChevronsLeft className="size-3.5" />)}
        {nav(page - 1, page === 1, "Previous page", <ChevronLeft className="size-3.5" />)}
        {Array.from({ length: last }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            type="button"
            aria-current={p === page ? "page" : undefined}
            onClick={() => onPageChange(p)}
            className={cn(BTN, "cursor-pointer", p === page ? "bg-field font-semibold" : "hover:bg-field")}
          >
            {p}
          </button>
        ))}
        {nav(page + 1, page === last, "Next page", <ChevronRight className="size-3.5" />)}
        {nav(last, page === last, "Last page", <ChevronsRight className="size-3.5" />)}
      </div>
    </div>
  );
}
