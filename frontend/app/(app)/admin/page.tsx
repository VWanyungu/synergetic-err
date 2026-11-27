"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Search, Users } from "lucide-react";
import { Alert } from "@/components/auth/auth-ui";
import { UserPanel } from "@/components/admin/user-panel";
import { Avatar, Skeleton } from "@/components/risk-detail/ui";
import { Dropdown } from "@/components/ui/dropdown";
import { Pagination } from "@/components/ui/pagination";
import { useAuth } from "@/contexts/auth-context";
import { useMe } from "@/hooks/queries/use-me";
import { USERS_PER_PAGE, useUsers, type RoleName, type UserFilters, type UserRow } from "@/hooks/queries/use-users";
import { fmtDate } from "@/lib/risk-detail";
import { cn } from "@/lib/utils";

const ROLES = [{ id: "", name: "All roles" }, { id: "Admin", name: "Admin" }, { id: "Risk Officer", name: "Risk Officer" }, { id: "Department Lead", name: "Department Lead" }, { id: "Risk Champion", name: "Risk Champion" }, { id: "Division Lead", name: "Division Lead" }];
const STATUSES = [{ id: "", name: "Any status" }, { id: "active", name: "Active" }, { id: "deactivated", name: "Deactivated" }];
const ROLE_STYLE: Record<RoleName, string> = { Admin: "bg-brand-bg text-brand-text-muted", "Risk Officer": "bg-info-bg text-info-fg", "Risk Champion": "bg-subtle text-ink-muted", "Department Lead": "bg-subtle text-ink-muted", "Division Lead": "bg-warning-bg text-warning-fg" };
const GRID = "grid grid-cols-[minmax(0,1.6fr)_150px_minmax(0,1fr)_110px_120px_16px] items-center gap-4 px-4";
const HEAD = "text-[11px] font-medium uppercase leading-[1.3] tracking-[0.66px] text-placeholder";

export default function AdminPage() {
  const router = useRouter();
  const { userId } = useAuth();
  const me = useMe();
  const [filters, setFilters] = useState<UserFilters>({ page: 1, search: "", role: "", status: "" });
  const [draft, setDraft] = useState("");
  const [seen, setSeen] = useState<UserRow | null>(null);
  // A user id opens their panel, "new" opens the create form, null shows the full table.
  const [open, setOpen] = useState<string | "new" | null>(null);
  const users = useUsers(filters);

  const roles = me.data?.roles.map((r) => r.role) ?? [];
  const allowed = roles.includes("Admin") || roles.includes("Risk Officer");
  // Opened by address by someone who may not be here: back to the dashboard.
  if (me.data && !allowed) {
    router.replace("/");
    return null;
  }

  const change = (patch: Partial<UserFilters>) => setFilters((f) => ({ ...f, page: 1, ...patch }));
  const data = users.data?.response;
  // The open user may be on another page of the list; keep the last row seen so paging does not close the panel.
  const found = open && open !== "new" ? data?.users.find((u) => u.id === open) : undefined;
  if (found && found !== seen) setSeen(found);
  const selected = open && open !== "new" ? (found ?? (seen?.id === open ? seen : null)) : null;
  const panelOpen = open === "new" || !!selected;

  return (
    <div className="flex flex-col gap-7">
      <header className={cn("flex items-end justify-between gap-3", panelOpen && "max-lg:hidden")}>
        <div className="flex flex-col gap-2">
          <h1 className="text-[26px] font-semibold sm:text-[32px] leading-[1.15] tracking-[-0.96px]">Users</h1>
          {/* <p className="max-w-[640px] text-[15px] leading-[1.6] text-ink-muted">
            Who can use the register and what they can do. {data ? `${data.activeCount} active ${data.activeCount === 1 ? "account" : "accounts"}.` : ""}
          </p> */}
        </div>
        <button type="button" onClick={() => setOpen("new")} className="btn-primary btn-auto shrink-0">
          <Plus className="size-[18px]" strokeWidth={2.5} />
          New user
        </button>
      </header>

      <div className={cn("flex flex-wrap items-center gap-3", panelOpen && "max-lg:hidden")}>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            change({ search: draft.trim() });
          }}
          className="flex h-11 w-full min-w-0 items-center sm:h-9 sm:w-auto sm:min-w-[260px] sm:flex-1 gap-2.5 rounded-full bg-field pl-3.5 pr-3"
        >
          <Search className="size-[18px] shrink-0 text-ink-muted" aria-hidden />
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft.trim() !== filters.search && change({ search: draft.trim() })} placeholder="Search by name or email" aria-label="Search users" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-placeholder" />
        </form>
        <Dropdown label="Role:" align="right" selectedId={filters.role} items={ROLES} onSelect={(role) => change({ role })} />
        <Dropdown label="Status:" align="right" selectedId={filters.status} items={STATUSES} onSelect={(status) => change({ status })} />
      </div>

      {users.isError ? (
        <div className="flex flex-col items-start gap-3">
          <Alert variant="error" title="Could not load users">{users.error.message}</Alert>
          <button type="button" className="btn-secondary btn-auto" onClick={() => users.refetch()}>Try again</button>
        </div>
      ) : !data ? (
        <div aria-busy="true" aria-label="Loading users" className="flex flex-col gap-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : data.users.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <Users className="size-8 text-ink-muted" strokeWidth={1.5} aria-hidden />
          <p className="text-[15px] font-medium">No users match</p>
          <p className="text-[14px] text-ink-muted">Try a different search or clear the filters.</p>
        </div>
      ) : (
        <div className={cn("gap-6", panelOpen ? "grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-0" : "block")}>
          {panelOpen ? (
            // With a panel open the table shrinks to names, so the panel gets the room.
            <nav aria-label="Users" className="hidden min-w-0 flex-col self-stretch lg:flex lg:border-r lg:border-line lg:pr-6">
              {data.users.map((u: UserRow) => (
                <button key={u.id} type="button" onClick={() => setOpen(u.id)} aria-current={u.id === open} className={cn("flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-300 hover:bg-subtle", u.id === open && "bg-field")}>
                  <Avatar name={`${u.first_name} ${u.last_name}`.trim()} size="sm" />
                  <span className={cn("truncate text-[14px] leading-[1.4]", u.id === open ? "font-semibold" : "font-medium", u.status === "deactivated" && "text-ink-muted line-through")}>{u.first_name} {u.last_name}</span>
                </button>
              ))}
              <Pagination compact page={filters.page} perPage={USERS_PER_PAGE} total={data.pagination.total} label="users" onPageChange={(page) => setFilters((f) => ({ ...f, page }))} />
            </nav>
          ) : (
            <div className="animate-fade-up">
              {/* Phones get a stacked list; the table needs the width. */}
              <div className="flex flex-col md:hidden">
                {data.users.map((u: UserRow) => (
                  <button key={u.id} type="button" onClick={() => setOpen(u.id)} className="flex min-h-16 w-full cursor-pointer items-center gap-3 border-b border-line py-3 text-left active:bg-subtle">
                    <Avatar name={`${u.first_name} ${u.last_name}`.trim()} size="md" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={cn("truncate text-[15px] font-medium leading-[1.4]", u.status === "deactivated" && "text-ink-muted line-through")}>{u.first_name} {u.last_name}</span>
                      <span className="truncate text-[13px] leading-normal text-ink-muted">{u.global_role ?? "No role"} · {u.division ?? u.department ?? "No scope"}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden />
                  </button>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <div className="min-w-[820px]">
                  <div className={cn(GRID, HEAD, "border-b border-line pb-3")}>
                    <span>User</span><span>Role</span><span>Department / division</span><span>Status</span><span>Last sign-in</span><span />
                  </div>
                  {data.users.map((u: UserRow) => (
                    <button key={u.id} type="button" onClick={() => setOpen(u.id)} className={cn(GRID, "w-full cursor-pointer border-b border-line py-3 text-left transition-colors duration-300 hover:bg-subtle")}>
                      <span className="flex min-w-0 items-center gap-3">
                        <Avatar name={`${u.first_name} ${u.last_name}`.trim()} size="md" />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-[14px] font-medium leading-[1.4]">{u.first_name} {u.last_name}</span>
                          <span className="truncate text-[13px] leading-normal text-ink-muted">{u.email}</span>
                        </span>
                      </span>
                      <span>{u.global_role ? <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-medium", ROLE_STYLE[u.global_role])}>{u.global_role}</span> : <span className="text-[13px] text-placeholder">No role</span>}</span>
                      <span className="truncate text-[14px]">{u.division ?? u.department ?? <span className="text-placeholder">None</span>}</span>
                      <span className={cn("w-max rounded-full px-2.5 py-0.5 text-[12px] font-medium", u.status === "active" ? "bg-success-bg text-success-fg" : "bg-danger-bg text-danger-fg")}>{u.status === "active" ? "Active" : "Deactivated"}</span>
                      <span className="text-[13px] text-ink-muted">{u.last_login ? fmtDate(u.last_login) : "Never"}</span>
                      <ChevronRight className="size-4 text-ink-muted" aria-hidden />
                    </button>
                  ))}
                </div>
              </div>
              <Pagination page={filters.page} perPage={USERS_PER_PAGE} total={data.pagination.total} label="users" onPageChange={(page) => setFilters((f) => ({ ...f, page }))} />
            </div>
          )}
          {panelOpen && <div className="min-w-0 lg:pl-8"><UserPanel key={open} user={selected} actorIsAdmin={roles.includes("Admin")} isSelf={selected?.id === userId} onClose={() => setOpen(null)} /></div>}
        </div>
      )}

    </div>
  );
}
