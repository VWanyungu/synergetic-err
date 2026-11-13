"use client";

import { useEffect, useId, useRef } from "react";
import { Check, X } from "lucide-react";
import { useAvatars } from "@/hooks/queries/use-me";
import { initialsOf } from "@/lib/risk-detail";
import { cn } from "@/lib/utils";

/** A person's profile picture when they have one, their initials otherwise. */
export function Avatar({ name, size = "md" }: { name: string; size?: "xs" | "sm" | "md" }) {
  const src = useAvatars().data?.[name];
  return (
    <span
      title={name}
      style={src ? { backgroundImage: `url(${src})` } : undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-brand-bg bg-cover bg-center font-semibold text-brand-text-muted",
        size === "xs" ? "size-5 text-[9px]" : size === "sm" ? "size-6 text-[10px]" : "size-8 text-[13px]",
      )}
    >
      {!src && initialsOf(name)}
    </span>
  );
}

export const RoleBadge = ({ role }: { role: string | null }) =>
  role ? (
    <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11px] font-medium uppercase leading-[1.3] tracking-[0.66px] text-ink-muted">
      {role}
    </span>
  ) : null;

/** Square tick / cross pair that confirms or abandons an inline edit. */
export function SaveCancel({ onSave, onCancel, busy, disabled }: { onSave: () => void; onCancel: () => void; busy?: boolean; disabled?: boolean }) {
  const base = "flex size-9 cursor-pointer items-center justify-center rounded-md border border-line bg-surface shadow-[0_1px_2px_rgba(17,17,17,0.08)] disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <div className="flex gap-1.5">
      <button type="button" aria-label="Save" disabled={busy || disabled} onClick={onSave} className={cn(base, "text-brand hover:bg-brand-bg")}>
        <Check className="size-4" />
      </button>
      <button type="button" aria-label="Cancel" disabled={busy} onClick={onCancel} className={cn(base, "hover:bg-field")}>
        <X className="size-4" />
      </button>
    </div>
  );
}

/** Centered dialog on a dimmed, blurred backdrop. Escape and a backdrop click close it. */
export function Modal({ title, onClose, children, width = 440 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ maxWidth: width }}
        className="max-h-[90vh] w-full overflow-y-auto rounded-[18px] border border-line bg-subtle p-[5px] shadow-[0_1px_3px_rgba(17,17,17,0.04),0_8px_24px_rgba(17,17,17,0.05)] outline-none"
      >
      <div className="flex flex-col overflow-hidden rounded-[13px] border border-line bg-surface">
        <div className="flex shrink-0 items-center justify-between border-b border-line py-[18px] pl-6 pr-5">
          <h2 id={titleId} className="text-[16px] font-semibold leading-[1.4] tracking-[-0.16px]">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="flex size-[18px] cursor-pointer items-center justify-center text-ink-muted hover:text-ink">
            <X className="size-[18px]" strokeWidth={2} />
          </button>
        </div>
        {children}
      </div>
      </div>
    </div>
  );
}

export const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] font-medium uppercase leading-[1.3] tracking-[0.66px] text-ink-muted">{children}</p>
);

export const Skeleton = ({ className }: { className?: string }) => <div className={cn("animate-pulse rounded-md bg-field", className)} />;
