"use client";

import { useState } from "react";
import { LoaderCircle, LogOut, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import { TextField, SelectField } from "@/components/risk-form/fields";
import { Avatar, SectionLabel } from "@/components/risk-detail/ui";
import { useDepartments } from "@/hooks/queries/use-risks";
import { useCreateUser, useRemoveSessions, useSetUserStatus, useUpdateUser, type RoleName, type UserRow } from "@/hooks/queries/use-users";
import { fmtDate } from "@/lib/risk-detail";
import { cn } from "@/lib/utils";

const NO_ROLE = "none";
const ROLE_HINT: Record<string, string> = {
  "Risk Champion": "Works inside one department: sees and edits only that department's risks, and asks a Risk Officer to archive.",
  "Department Lead": "The same permissions as a Risk Champion: one department, edits its risks, asks a Risk Officer to archive.",
  "Division Lead": "Read-only. Sees the register for their division and the risks affecting it, and nothing else.",
  "Risk Officer": "Sees every department, edits any risk, decides archive requests and manages users.",
  Admin: "Everything a Risk Officer can do, plus managing other Admins.",
  [NO_ROLE]: "Can read the registers and comment, but cannot edit risks.",
};
const DEPARTMENT_ROLES = ["Risk Champion", "Department Lead"];

const useDivisionOptions = () => useQuery({ queryKey: ["division-options"], queryFn: () => api<{ id: string; name: string }[]>("/divisions") });
const lastSeen = (iso: string | null) => (iso ? `${fmtDate(iso)}, ${new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "Never signed in");
const BUTTON = "flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

/** One user beside the list: details, permissions and access. With no `user` it is the form for a new one. */
export function UserPanel({ user, actorIsAdmin, isSelf, onClose }: { user: UserRow | null; actorIsAdmin: boolean; isSelf: boolean; onClose: () => void }) {
  const creating = !user;
  const departments = useDepartments();
  const divisions = useDivisionOptions();
  const create = useCreateUser();
  const update = useUpdateUser(user?.id ?? "");
  const setStatus = useSetUserStatus(user?.id ?? "");
  const removeSessions = useRemoveSessions(user?.id ?? "");

  const [first, setFirst] = useState(user?.first_name ?? "");
  const [last, setLast] = useState(user?.last_name ?? "");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(user?.phone_number ?? "");
  const [department, setDepartment] = useState(user?.department_id ?? "");
  const [division, setDivision] = useState(user?.division_id ?? "");
  const [role, setRole] = useState<string>(user?.global_role ?? NO_ROLE);
  const [confirming, setConfirming] = useState(false);

  // A Risk Officer cannot touch an Admin's account or hand out Admin.
  const locked = !actorIsAdmin && user?.global_role === "Admin";
  const roles = [
    { id: NO_ROLE, name: "No role" },
    { id: "Department Lead", name: "Department Lead" },
    { id: "Risk Champion", name: "Risk Champion" },
    { id: "Division Lead", name: "Division Lead" },
    { id: "Risk Officer", name: "Risk Officer" },
    ...(actorIsAdmin ? [{ id: "Admin", name: "Admin" }] : []),
  ];
  const isDivisionLead = role === "Division Lead";
  const needsDepartment = DEPARTMENT_ROLES.includes(role) && !department;
  const needsDivision = isDivisionLead && !division;
  const roleChanged = !creating && role !== (user.global_role ?? NO_ROLE);
  const scopeChanged = !creating && (department !== (user.department_id ?? "") || division !== (user.division_id ?? ""));
  const dirty = creating
    ? !!first.trim() && !!last.trim() && !!email.trim()
    : first.trim() !== user.first_name || last.trim() !== user.last_name || phone.trim() !== (user.phone_number ?? "") || roleChanged || scopeChanged;
  const invalid = !first.trim() || !last.trim() || (creating && !email.trim()) || needsDepartment || needsDivision;

  const body = { firstName: first.trim(), lastName: last.trim(), phone: phone.trim() || null, departmentId: isDivisionLead ? null : department || null, divisionId: isDivisionLead ? division || null : null, globalRole: role === NO_ROLE ? null : (role as RoleName) };
  const save = () =>
    creating
      ? create.mutate({ ...body, email: email.trim() }, { onSuccess: () => { toast.success("User created"); onClose(); }, onError: (e) => toast.error(e.message) })
      : update.mutate(body, {
          onSuccess: () => {
            toast.success(roleChanged || scopeChanged ? "Saved. They will be signed out to apply the change." : "Details saved");
            onClose();
          },
          onError: (e) => toast.error(e.message),
        });

  const deactivated = user?.status === "deactivated";
  const toggleStatus = () =>
    setStatus.mutate(deactivated ? "active" : "deactivated", {
      onSuccess: () => toast.success(deactivated ? "Account reactivated" : "Account deactivated and signed out"),
      onError: (e) => toast.error(e.message),
    });
  const signOut = () =>
    removeSessions.mutate(undefined, {
      onSuccess: () => {
        toast.success("Signed out everywhere");
        setConfirming(false);
      },
      onError: (e) => toast.error(e.message),
    });
  const busy = create.isPending || update.isPending;

  return (
    <aside aria-label={creating ? "New user" : "User details"} className="animate-fade-up flex min-w-0 flex-col self-start">
      <header className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
        {creating ? (
          <h2 className="text-[16px] font-semibold leading-[1.4] tracking-[-0.16px]">New user</h2>
        ) : (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={`${user.first_name} ${user.last_name}`.trim()} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[16px] font-semibold leading-[1.3]">{user.first_name} {user.last_name}</span>
              <span className="truncate text-[13px] leading-normal text-ink-muted">{user.email}</span>
            </div>
          </div>
        )}
        <button type="button" aria-label="Close" onClick={onClose} className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-muted hover:bg-field hover:text-ink">
          <X className="size-[18px]" />
        </button>
      </header>

      <div className="flex flex-col gap-6 px-6 py-5">
        {locked && <p className="rounded-lg bg-subtle px-3 py-2 text-[13px] leading-normal text-ink-muted">This is an Admin account. Only an Admin can change it.</p>}

        <section className="flex flex-col gap-3" aria-label="Details">
          <SectionLabel>Details</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="First name" value={first} onChange={(e) => setFirst(e.target.value)} disabled={locked} />
            <TextField label="Last name" value={last} onChange={(e) => setLast(e.target.value)} disabled={locked} />
          </div>
          {creating && <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@organisation.co.ke" />}
          <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={locked} placeholder="Optional" />
          {!creating && <p className="text-[13px] leading-normal text-ink-muted">Member since {fmtDate(user.created_at)}. Last sign-in: {lastSeen(user.last_login)}.</p>}
        </section>

        <section className="flex flex-col gap-3" aria-label="Permissions">
          <SectionLabel>Permissions</SectionLabel>
          <SelectField label="Role" value={role} items={roles} onChange={setRole} placeholder="Select a role" emptyText="" />
          {/* <p className="text-[13px] leading-normal text-ink-muted">{ROLE_HINT[role]}</p> */}
          {isDivisionLead ? (
            <SelectField label="Division" value={division} items={divisions.data ?? []} onChange={setDivision} placeholder="Select a division" emptyText="No divisions" error={needsDivision ? "A Division Lead needs a division." : undefined} />
          ) : (
            <SelectField label="Department" value={department} items={departments.data ?? []} onChange={setDepartment} placeholder="No department" emptyText="No departments" error={needsDepartment ? `A ${role} needs a department.` : undefined} />
          )}
          {(roleChanged || scopeChanged) && <p className="text-[13px] leading-normal text-warning-fg">Changing the role, department or division signs this person out, so it applies when they sign in again.</p>}
        </section>

        {creating ? (
          <p className="rounded-lg bg-subtle px-3 py-2 text-[13px] leading-normal text-ink-muted">Default password is ChangeMe123! User can change it from Forgot password page.</p>
        ) : (
          <section className="flex flex-col gap-3" aria-label="Access">
            <SectionLabel>Access</SectionLabel>
            <div className="flex gap-2 flex-wrap">
              {confirming ? (
                <div className="flex gap-2">
                  <button type="button" disabled={removeSessions.isPending || locked} onClick={signOut} className="btn-primary btn-auto !py-1.5 !text-[14px]">
                    {removeSessions.isPending && <LoaderCircle className="size-3.5 animate-spin" />}
                    Sign out
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} className="btn-secondary btn-auto !py-1.5 !text-[14px]">Cancel</button>
                </div>
              ) : (
                <button type="button" disabled={locked} onClick={() => setConfirming(true)} className={cn(BUTTON, "bg-field hover:bg-line")}>
                  <LogOut className="size-3.5" aria-hidden />
                  Remove sessions
                </button>
              )}

              <button type="button" disabled={locked || isSelf || setStatus.isPending} onClick={toggleStatus} title={isSelf ? "You cannot deactivate your own account" : undefined} className={cn(BUTTON, deactivated ? "bg-success-bg text-success-fg hover:opacity-80" : "bg-danger-bg text-danger-fg hover:opacity-80")}>
                  {setStatus.isPending && <LoaderCircle className="size-3.5 animate-spin" />}
                  {deactivated ? "Reactivate" : "Deactivate"}
                </button>
            </div>
            
            {/* <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
              <div className="flex flex-col">
                <span className="text-[14px] font-medium leading-[1.4]">Sessions</span>
                <span className="text-[13px] leading-normal text-ink-muted">Signs them out of every device. They can sign back in.</span>
              </div>
              {confirming ? (
                <div className="flex gap-2">
                  <button type="button" disabled={removeSessions.isPending || locked} onClick={signOut} className="btn-primary btn-auto !py-1.5 !text-[14px]">
                    {removeSessions.isPending && <LoaderCircle className="size-3.5 animate-spin" />}
                    Sign out
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} className="btn-secondary btn-auto !py-1.5 !text-[14px]">Cancel</button>
                </div>
              ) : (
                <button type="button" disabled={locked} onClick={() => setConfirming(true)} className={cn(BUTTON, "bg-field hover:bg-line")}>
                  <LogOut className="size-3.5" aria-hidden />
                  Remove sessions
                </button>
              )}
            </div> */}
            {/* <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
              <div className="flex flex-col">
                <span className="text-[14px] font-medium leading-[1.4]">{deactivated ? "Account is deactivated" : "Account is active"}</span>
                <span className="text-[13px] leading-normal text-ink-muted">{deactivated ? "They cannot sign in until you reactivate it." : "Deactivating also signs them out. Their records stay."}</span>
              </div>
              <button type="button" disabled={locked || isSelf || setStatus.isPending} onClick={toggleStatus} title={isSelf ? "You cannot deactivate your own account" : undefined} className={cn(BUTTON, deactivated ? "bg-success-bg text-success-fg hover:opacity-80" : "bg-danger-bg text-danger-fg hover:opacity-80")}>
                {setStatus.isPending && <LoaderCircle className="size-3.5 animate-spin" />}
                {deactivated ? "Reactivate" : "Deactivate"}
              </button>
            </div> */}
          </section>
        )}
      </div>

      <footer className="flex justify-end gap-3 px-6 py-4">
        <button type="button" onClick={onClose} className="btn-secondary btn-auto">{creating ? "Cancel" : "Close"}</button>
        <button type="button" disabled={locked || !dirty || invalid || busy} onClick={save} className="btn-primary btn-auto">
          {busy && <LoaderCircle className="size-4 animate-spin" />}
          {creating ? "Create user" : "Save changes"}
        </button>
      </footer>
    </aside>
  );
}
