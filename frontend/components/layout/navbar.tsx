"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, ChevronDown, ChevronRight, Layers, List, Moon, Network, Plus, Sun } from "lucide-react";
import { GlobalSearch } from "@/components/layout/global-search";
import { useTheme } from "@/components/theme-provider";
import { ICONS } from "@/components/registers/registers-view";
import { useDivisions, useRegisters } from "@/hooks/queries/use-registers";
import { useUnreadCount } from "@/hooks/queries/use-notifications";
import { useMe } from "@/hooks/queries/use-me";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const LINK = "flex h-9 whitespace-nowrap items-center gap-1.5 rounded-md px-3.5 text-[14px] font-medium leading-[1.4]";

const COLUMNS = [
  { kind: "department", label: "Departments", all: "/risks", base: "/risks/register", icon: Building2 },
  { kind: "division", label: "Divisions", all: "/risks?kind=division", base: "/risks/division", icon: Network },
] as const;

const ACTIVE = "bg-field text-ink";
const IDLE = "text-ink-muted hover:bg-field/60";
const ROW = "group/item flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-subtle focus-visible:bg-subtle";
const TILE = "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-300 group-hover/item:bg-brand group-hover/item:text-white group-focus-visible/item:bg-brand group-focus-visible/item:text-white";

/** The bell with its unread count set into the icon: a notch is cut from the bell and the number sits in it. */
function BellWithCount({ count }: { count: number }) {
  const id = "bell-notch";
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {count > 0 && (
        <defs>
          <mask id={id}>
            <rect width="24" height="24" fill="white" />
            <circle cx="17" cy="7" r="8.2" fill="black" />
          </mask>
        </defs>
      )}
      <g mask={count > 0 ? `url(#${id})` : undefined}>
        <path d="M10.268 21a2 2 0 0 0 3.464 0" />
        <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
      </g>
      {count > 0 && (
        <>
          <circle cx="17" cy="7" r="6.6" fill="var(--color-brand)" stroke="none" />
          <text x="17" y="7.3" textAnchor="middle" dominantBaseline="central" fontSize="9" fontWeight="700" fill="white" stroke="none">{count > 9 ? "9+" : count}</text>
        </>
      )}
    </svg>
  );
}

/** Sticky top bar. Hover-menus are CSS-only (group-hover / focus-within) so they work by keyboard too. */
export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { email, logout } = useAuth();
  const { toggle: toggleTheme } = useTheme();
  const me = useMe();
  const count = useUnreadCount().data ?? 0;
  const registers = useRegisters();
  const divisions = useDivisions();
  // The Registers tab covers the overview, each register and individual risks; Heat map and New risk have their own spots.
  const inRegisters = pathname.startsWith("/risks") && !pathname.startsWith("/risks/distribution") && pathname !== "/risks/new";
  const initials = (email ?? "").slice(0, 2).toUpperCase();

  const link = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      className={cn(LINK, active ? ACTIVE : IDLE)}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 flex h-[72px] items-center gap-4 border-b border-line bg-surface px-8">
      <Link href="/" className="shrink-0">
        <Image src="/synergetic-logo.png" alt="Synergetic" width={106} height={45} priority />
      </Link>
      <nav className="ml-4 flex items-center gap-1">
        {link("/", "Dashboard", pathname === "/")}

        <div className="group relative">
          <Link href="/risks" className={cn(LINK, inRegisters ? ACTIVE : "text-ink-muted group-hover:bg-field/60")}>
            Registers
            <ChevronDown className="size-3.5 transition-transform duration-300 group-hover:rotate-180 group-has-[:focus-visible]:rotate-180" />
          </Link>
          {/* pt-2 bridges the gap so the pointer can travel from the tab to the panel */}
          <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition-opacity duration-200 group-has-[:focus-visible]:visible group-has-[:focus-visible]:opacity-100 group-hover:visible group-hover:opacity-100">
            <div className="w-[280px] rounded-2xl border border-line bg-surface p-2 shadow-[0_8px_30px_rgba(17,17,17,0.08)]">
              <Link href="/risks" className={cn(ROW, pathname === "/risks" && "bg-subtle")}>
                <span className={cn(TILE, "bg-field text-ink")}><List className="size-4" aria-hidden /></span>
                <span className="min-w-0 flex-1 text-[14px] font-medium leading-[1.4]">All registers</span>
              </Link>
              <div className="mx-3 my-1.5 h-px bg-line" />
              {COLUMNS.map(({ kind, label, all, base, icon: KindIcon }) => {
                const list = kind === "division" ? divisions : registers;
                const inKind = pathname.startsWith(base);
                return (
                  // Secondary menu: hovering (or focusing) a kind opens its list to the right.
                  <div key={kind} className="group/sub relative">
                    <Link href={all} className={cn(ROW, "group-hover/sub:bg-subtle group-has-[:focus-visible]/sub:bg-subtle", inKind && "bg-subtle")}>
                      <span className={cn(TILE, "bg-field text-ink group-hover/sub:bg-brand group-hover/sub:text-white")}><KindIcon className="size-4" aria-hidden /></span>
                      <span className="min-w-0 flex-1 text-[14px] font-medium leading-[1.4]">{label}</span>
                      <ChevronRight className="size-4 shrink-0" aria-hidden />
                    </Link>
                    {/* pl-2 bridges the gap so the pointer can travel into the submenu */}
                    <div className="invisible absolute left-full top-[-9px] z-50 pl-2 opacity-0 transition-opacity duration-200 group-hover/sub:visible group-hover/sub:opacity-100 group-has-[:focus-visible]/sub:visible group-has-[:focus-visible]/sub:opacity-100">
                      <ul className="max-h-[460px] w-[300px] overflow-y-auto rounded-2xl border border-line bg-surface p-2 shadow-[0_8px_30px_rgba(17,17,17,0.08)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {list.data?.map((r) => {
                          const Icon = ICONS[r.code] ?? Layers;
                          const href = `${base}/${r.id}`;
                          return (
                            <li key={r.id}>
                              <Link href={href} className={cn(ROW, "py-2", pathname === href && "bg-subtle")}>
                                <span className={cn(TILE, "size-8 bg-field text-ink")}><Icon className="size-4" aria-hidden /></span>
                                <span className="min-w-0 flex-1 truncate text-[14px] font-medium leading-[1.4]">{r.name}</span>
                                <span className="text-[13px] leading-normal text-ink-muted">{r.total}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {link("/risks/distribution", "Heat map", pathname.startsWith("/risks/distribution"))}
        {link("/reports", "Reports", pathname.startsWith("/reports"))}
      </nav>

      <div className="flex-1" />

      <GlobalSearch />

      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle dark mode"
        title="Toggle dark mode"
        className="flex size-9 cursor-pointer items-center justify-center rounded-full hover:bg-field"
      >
        <span className="theme-icon-window size-[18px]">
          <Moon className="theme-icon theme-icon-moon size-[18px]" />
          <Sun className="theme-icon theme-icon-sun size-[18px]" />
        </span>
      </button>

      <Link href="/notifications" aria-label={count ? `Notifications, ${count} unread` : "Notifications"} className="flex size-9 items-center justify-center rounded-full hover:bg-field">
        <BellWithCount count={count} />
      </Link>

      <Link
        href="/risks/new"
        className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-line-input px-4 text-[14px] font-medium leading-[1.4] transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-field active:scale-[0.98]"
      >
        <Plus className="size-4 text-brand" strokeWidth={2} aria-hidden />
        New risk
      </Link>

      <div className="group relative">
        <button
          className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-success-bg bg-cover bg-center text-[13px] font-semibold text-success-fg"
          style={me.data?.avatarUrl ? { backgroundImage: `url(${me.data.avatarUrl})` } : undefined}
          aria-label="Account menu"
        >
          {!me.data?.avatarUrl && initials}
        </button>
        <div className="invisible absolute right-0 top-full z-50 pt-2 opacity-0 transition-opacity group-has-[:focus-visible]:visible group-has-[:focus-visible]:opacity-100 group-hover:visible group-hover:opacity-100">
          <div className="w-56 rounded-xl border border-line bg-surface p-2 shadow-[0_8px_30px_rgba(17,17,17,0.1)]">
            <p className="truncate px-3 py-2 text-[13px] text-ink-muted">{email}</p>
            <Link href="/profile" className="block rounded-lg px-3 py-2 text-[14px] font-medium hover:bg-field/60">
              My profile
            </Link>
            <button
              className="w-full cursor-pointer rounded-lg px-3 py-2 text-left text-[14px] font-medium hover:bg-field/60"
              onClick={async () => {
                await logout();
                router.replace("/login");
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
