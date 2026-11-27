"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, ChevronDown, Moon, Plus, Sun } from "lucide-react";
import { GlobalSearch } from "@/components/layout/global-search";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/contexts/auth-context";
import { useMe } from "@/hooks/queries/use-me";
import { useDivisions, useRegisters } from "@/hooks/queries/use-registers";
import { isDivisionLead } from "@/lib/roles";
import { cn } from "@/lib/utils";

const EASE = "ease-[cubic-bezier(0.32,0.72,0,1)]";
const ROW = "flex min-h-12 items-center justify-between rounded-xl px-4 text-[17px] font-medium leading-[1.3] tracking-[-0.2px] transition-colors duration-300 active:bg-field";

/** Below `lg` the top bar keeps only the logo, the bell and this button. It opens a full-height sheet holding everything the desktop bar spreads across. */
export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { email, logout } = useAuth();
  const { toggle: toggleTheme } = useTheme();
  const me = useMe().data;
  const registers = useRegisters();
  const divisions = useDivisions();
  // Open for one route only: following a link changes the pathname, which closes the sheet without an effect.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const setOpen = (next: boolean | ((o: boolean) => boolean)) => setOpenPath((typeof next === "function" ? next(open) : next) ? pathname : null);
  const [group, setGroup] = useState<"department" | "division" | null>(null);
  const lead = !!me && isDivisionLead(me.roles.map((r) => r.role));
  const manages = !!me?.roles.some((r) => r.role === "Admin" || r.role === "Risk Officer");

  // A tap on a link changes the route; the sheet should not sit on top of the new page.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const item = (href: string, label: string, active: boolean, i: number) => (
    <Link key={href} href={href} style={{ transitionDelay: open ? `${80 + i * 45}ms` : "0ms" }} className={cn(ROW, "translate-y-0 transition-[opacity,transform,background-color] duration-500", EASE, !open && "translate-y-6 opacity-0", active && "bg-field")}>
      {label}
      <ArrowUpRight className="size-4 text-ink-muted" strokeWidth={1.75} aria-hidden />
    </Link>
  );

  const sub = (kind: "department" | "division", label: string, base: string, list: typeof registers) => (
    <div key={kind}>
      <button type="button" onClick={() => setGroup(group === kind ? null : kind)} aria-expanded={group === kind} className={cn(ROW, "w-full cursor-pointer")}>
        {label}
        <ChevronDown className={cn("size-4 text-ink-muted transition-transform duration-500", EASE, group === kind && "rotate-180")} strokeWidth={1.75} aria-hidden />
      </button>
      {group === kind && (
        <ul className="mb-1 ml-4 flex flex-col border-l border-line pl-2">
          <li><Link href={kind === "department" ? "/risks" : "/risks?kind=division"} className="flex min-h-11 items-center rounded-lg px-3 text-[15px] text-ink-muted active:bg-field">All {label.toLowerCase()}</Link></li>
          {list.data?.map((r) => (
            <li key={r.id}>
              <Link href={`${base}/${r.id}`} className={cn("flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 text-[15px] active:bg-field", pathname === `${base}/${r.id}` && "bg-field font-medium")}>
                <span className="truncate">{r.name}</span>
                <span className="text-[13px] text-ink-muted">{r.total}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} className="relative flex size-11 cursor-pointer items-center justify-center rounded-full active:bg-field lg:hidden">
        <span className={cn("absolute h-[1.5px] w-5 rounded-full bg-ink transition-transform duration-500", EASE, open ? "rotate-45" : "-translate-y-[3.5px]")} />
        <span className={cn("absolute h-[1.5px] w-5 rounded-full bg-ink transition-transform duration-500", EASE, open ? "-rotate-45" : "translate-y-[3.5px]")} />
      </button>

      <div aria-hidden={!open} className={cn("fixed inset-x-0 bottom-0 top-[72px] z-40 overflow-y-auto overscroll-contain border-t border-line bg-surface px-4 pb-10 pt-5 transition-[opacity,visibility] duration-500 lg:hidden", EASE, open ? "visible opacity-100" : "invisible opacity-0")}>
        <GlobalSearch mobile onNavigate={() => setOpen(false)} />

        <nav className="mt-5 flex flex-col gap-0.5">
          {lead && me?.divisionId ? (
            item(`/risks/division/${me.divisionId}`, "My division", pathname.startsWith("/risks"), 0)
          ) : (
            <>
              {item("/", "Dashboard", pathname === "/", 0)}
              {sub("department", "Departments", "/risks/register", registers)}
              {sub("division", "Divisions", "/risks/division", divisions)}
              {item("/risks/distribution", "Heat map", pathname.startsWith("/risks/distribution"), 3)}
              {item("/reports", "Reports", pathname.startsWith("/reports"), 4)}
              {manages && item("/admin", "Admin", pathname.startsWith("/admin"), 5)}
            </>
          )}
        </nav>

        {!lead && (
          <Link href="/risks/new" className="mt-6 flex h-12 items-center justify-center gap-2 rounded-full border border-line-input text-[15px] font-medium active:scale-[0.98]">
            <Plus className="size-4 text-brand" strokeWidth={2} aria-hidden />
            New risk
          </Link>
        )}

        <div className="mt-8 border-t border-line pt-5">
          <p className="truncate px-4 pb-2 text-[13px] text-ink-muted">{email}</p>
          <Link href="/profile" className={ROW}>My profile</Link>
          <button type="button" onClick={toggleTheme} className={cn(ROW, "w-full cursor-pointer")}>
            Appearance
            <span className="theme-icon-window size-[18px]">
              <Moon className="theme-icon theme-icon-moon size-[18px]" />
              <Sun className="theme-icon theme-icon-sun size-[18px]" />
            </span>
          </button>
          <button type="button" onClick={async () => { await logout(); router.replace("/login"); }} className={cn(ROW, "w-full cursor-pointer text-ink-muted")}>Log out</button>
        </div>
      </div>
    </>
  );
}
