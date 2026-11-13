"use client";

import { forwardRef, useEffect, useId, useRef, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, CircleAlert, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/** Filled box with the label above the value; a red underline and message when `error` is set. */
function Shell({
  error,
  className,
  children,
}: {
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {children}
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-[13px] leading-normal text-danger-fg">
          <CircleAlert className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

const BOX = "flex w-full gap-2 rounded-t-sm border-b-2 bg-field px-3.5 py-2 text-left transition-colors";
const boxLine = (error?: string) => (error ? "border-red-500" : "border-transparent focus-within:border-brand");
const LABEL = "text-[13px] leading-normal";
const labelColor = (error?: string) => (error ? "text-danger-fg" : "text-ink-muted");
const VALUE = "w-full bg-transparent text-[15px] leading-[1.6] text-ink outline-none placeholder:text-placeholder";

type TextProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };

export const TextField = forwardRef<HTMLInputElement, TextProps>(function TextField({ label, error, className, ...props }, ref) {
  const id = useId();
  return (
    <Shell error={error} className={className}>
      <div className={cn(BOX, "min-h-14 flex-col", boxLine(error))}>
        <label htmlFor={id} className={cn(LABEL, labelColor(error))}>{label}</label>
        <input id={id} ref={ref} aria-invalid={!!error} className={VALUE} {...props} />
      </div>
    </Shell>
  );
});

type AreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string };

export const TextareaField = forwardRef<HTMLTextAreaElement, AreaProps>(function TextareaField({ label, error, className, ...props }, ref) {
  const id = useId();
  return (
    <Shell error={error} className={className}>
      <div className={cn(BOX, "min-h-[120px] flex-col", boxLine(error))}>
        <label htmlFor={id} className={cn(LABEL, labelColor(error))}>{label}</label>
        <textarea id={id} ref={ref} aria-invalid={!!error} className={cn(VALUE, "min-h-[80px] flex-1 resize-none")} {...props} />
      </div>
    </Shell>
  );
});

/** Native date input so the browser supplies the calendar; the box matches the other fields. */
export const DateField = forwardRef<HTMLInputElement, TextProps>(function DateField(props, ref) {
  return <TextField ref={ref} type="date" {...props} />;
});

export function SelectField({
  label,
  value,
  items,
  onChange,
  placeholder,
  emptyText,
  error,
  className,
}: {
  label: string;
  value: string;
  items: { id: string; name: string }[];
  onChange: (id: string) => void;
  placeholder: string;
  emptyText: string;
  error?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; top: number; width: number } | null>(null);
  const close = () => {
    setOpen(false);
    setQuery("");
  };
  // The list is portalled to <body> and positioned from the field, so a dialog or scroll area around the field cannot clip it.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (r) setBox({ left: r.left, top: r.bottom + 8, width: r.width });
    };
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !popover.current?.contains(t)) {
        setOpen(false);
        setQuery("");
      }
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("mousedown", away);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", away);
    };
  }, [open]);
  const selected = items.find((i) => i.id === value);
  const shown = items.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <Shell error={error} className={className}>
      <div ref={ref} className="relative" onKeyDown={(e) => e.key === "Escape" && close()}>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={cn(BOX, "min-h-14 cursor-pointer items-center", error ? "border-red-500" : open ? "border-brand" : "border-transparent")}
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className={cn(LABEL, labelColor(error))}>{label}</span>
            <span className={cn("truncate text-[15px] leading-[1.6]", selected ? "text-ink" : "text-placeholder")}>
              {selected?.name ?? placeholder}
            </span>
          </span>
          <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
        </button>
        {open && box && createPortal(
          <div
            ref={popover}
            onKeyDown={(e) => e.key === "Escape" && close()}
            style={{ left: box.left, top: box.top, width: box.width }}
            className="fixed z-[60] rounded-2xl border border-line bg-surface p-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
          >
            <label className="mb-1 flex items-center gap-2 rounded-xl bg-field px-3 py-2">
              <Search className="size-4 shrink-0 text-ink-muted" aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                aria-label={`Search ${label.replace(" *", "").toLowerCase()}`}
                className="w-full bg-transparent text-[14px] outline-none placeholder:text-placeholder"
              />
            </label>
            <ul role="listbox" className="max-h-52 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {shown.length === 0 && <li className="px-3 py-2 text-[13px] text-ink-muted">{items.length === 0 ? emptyText : "No matches"}</li>}
              {shown.map((item) => (
                <li
                  key={item.id}
                  role="option"
                  aria-selected={item.id === value}
                  onClick={() => {
                    onChange(item.id);
                    close();
                  }}
                  className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-1.5 text-[14px] hover:bg-field", item.id === value && "bg-field font-medium")}
                >
                  {item.name}
                  {item.id === value && <Check className="ml-auto size-4 shrink-0 text-brand" />}
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
      </div>
    </Shell>
  );
}

/** Single-choice row of segments (impact, likelihood, response, status). */
export function SegmentGroup<T extends string | number>({
  label,
  value,
  options,
  onChange,
  ends,
  error,
  className,
}: {
  label: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ends?: [string, string];
  error?: string;
  className?: string;
}) {
  return (
    <Shell error={error} className={className}>
      <div role="radiogroup" aria-label={label} className="flex flex-col gap-1.5">
        <p className={cn("text-[14px] font-medium leading-[1.4]", error ? "text-danger-fg" : "text-ink")}>{label}</p>
        <div className="flex gap-2">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={o.value === value}
              onClick={() => onChange(o.value)}
              className={cn(
                "h-10 min-w-0 flex-1 cursor-pointer rounded-t-sm border-b-2 px-3 text-[14px] font-medium leading-[1.4]",
                o.value === value ? "border-brand bg-brand-bg text-brand-text-muted" : "border-transparent bg-field text-ink hover:bg-line",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        {ends && (
          <div className="flex justify-between text-[13px] leading-normal text-ink-muted">
            <span>{ends[0]}</span>
            <span>{ends[1]}</span>
          </div>
        )}
      </div>
    </Shell>
  );
}

/** Multi-select chips; a selected chip shows a check. */
export function ChipGroup({
  options,
  value,
  onChange,
  emptyText,
}: {
  options: { id: string; name: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  emptyText: string;
}) {
  if (options.length === 0) return <p className="text-[14px] text-ink-muted">{emptyText}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.id) : [...value, o.id])}
            className={cn(
              "flex h-[34px] cursor-pointer items-center gap-1.5 rounded-t-sm px-3.5 text-[14px] font-medium leading-[1.4]",
              on ? "bg-brand-bg text-brand-text-muted" : "bg-field text-ink hover:bg-line",
            )}
          >
            {on && <Check className="size-3.5" aria-hidden />}
            {o.name}
          </button>
        );
      })}
    </div>
  );
}
