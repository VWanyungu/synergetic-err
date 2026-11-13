"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Building2, ClipboardList, Search, ShieldAlert } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface Hit {
  id: string;
  title: string;
  subtitle: string;
}
interface Results {
  risks: Hit[];
  registers: Hit[];
  plans: Hit[];
}

/** The server needs two characters; asking sooner only wastes a round trip. */
const MIN_QUERY = 2;

const GROUPS = [
  { key: "risks", label: "Risks", icon: ShieldAlert, href: (h: Hit) => `/risks/${h.id}` },
  { key: "registers", label: "Registers", icon: Building2, href: (h: Hit) => `/risks/register/${h.id}` },
  { key: "plans", label: "Mitigation plans", icon: ClipboardList, href: (h: Hit) => `/risks/${h.id}` },
] as const;

/** The navbar's search field, as in Gas Connect: results drop down under it while it is focused; Escape or an outside click collapses them. */
export function GlobalSearch() {
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const debounced = useDebouncedValue(query.trim(), 200);
  useOutsideClick(boxRef, () => setOpen(false));

  // Cmd/Ctrl+K from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => api<Results>(`/search?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length >= MIN_QUERY,
    staleTime: 30_000,
  });

  // One flat list behind the grouped display, so the arrow keys cross group boundaries.
  const flat = useMemo(() => (data ? GROUPS.flatMap((g) => data[g.key].map((hit) => ({ key: g.key, hit, href: g.href(hit) }))) : []), [data]);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (flat.length === 0 ? 0 : (i + (e.key === "ArrowDown" ? 1 : -1) + flat.length) % flat.length));
    } else if (e.key === "Enter" && flat[active]) {
      e.preventDefault();
      go(flat[active].href);
    }
  };

  const tooShort = debounced.length > 0 && debounced.length < MIN_QUERY;
  const noResults = !isFetching && debounced.length >= MIN_QUERY && !!data && flat.length === 0;

  return (
    <div ref={boxRef} className="relative hidden xl:block">
      <label className="flex h-9 w-[280px] items-center gap-2.5 rounded-full bg-field pl-3.5 pr-2">
        <Search className="size-[18px] shrink-0 text-ink-muted" aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search risks, IDs, owners"
          aria-label="Search risks, registers and mitigation plans"
          className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-placeholder"
        />
        {!query && <kbd className="rounded-sm border border-line bg-surface px-1.5 py-0.5 font-mono text-[13px] text-ink-muted">⌘K</kbd>}
      </label>

      {open && (
        <div role="listbox" aria-label="Search results" className="absolute right-0 top-[calc(100%+8px)] z-50 flex w-[400px] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-[0_8px_30px_rgba(17,17,17,0.1)]">
          <div className="max-h-[52vh] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {query.length === 0 && <p className="px-4 py-5 text-[13px] text-ink-muted">Type to search risks, registers and mitigation plans.</p>}
            {tooShort && <p className="px-4 py-5 text-[13px] text-ink-muted">Keep typing: at least {MIN_QUERY} characters.</p>}
            {noResults && <p className="px-4 py-5 text-[13px] text-ink-muted">Nothing matches “{debounced}”.</p>}
            {GROUPS.map((g) => {
              const hits = data?.[g.key] ?? [];
              if (hits.length === 0) return null;
              return (
                <div key={g.key} className="flex flex-col">
                  <p className="bg-subtle px-4 py-1.5 text-[11px] font-medium uppercase leading-[1.3] tracking-[0.66px] text-ink-muted">{g.label}</p>
                  {hits.map((hit) => {
                    const index = flat.findIndex((f) => f.key === g.key && f.hit === hit);
                    return (
                      <button
                        key={`${g.key}-${hit.id}-${hit.title}`}
                        type="button"
                        onMouseEnter={() => setActive(index)}
                        onClick={() => go(g.href(hit))}
                        className={cn("flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left", index === active ? "bg-field" : "hover:bg-field/60")}
                      >
                        <g.icon className="size-4 shrink-0 text-brand" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium leading-[1.4]">{hit.title}</span>
                          <span className="block truncate text-[12px] leading-normal text-ink-muted">{hit.subtitle}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[11px] text-ink-muted">
            <span>↑↓ to move · ↵ to open · Esc to close</span>
            {isFetching && <span>Searching…</span>}
          </div>
        </div>
      )}
    </div>
  );
}
