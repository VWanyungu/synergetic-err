import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export type RoleName = "Admin" | "Risk Officer" | "Risk Champion" | "Department Lead" | "Division Lead";

export interface UserRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  status: "active" | "deactivated";
  is_verified: boolean;
  last_login: string | null;
  created_at: string;
  global_role: RoleName | null;
  department_id: string | null;
  department: string | null;
  division_id: string | null;
  division: string | null;
}

export interface UserFilters {
  page: number;
  search: string;
  role: string;
  status: string;
}

export const USERS_PER_PAGE = 10;

interface UserList {
  response: { users: UserRow[]; pagination: { page: number; limit: number; total: number; pages: number }; activeCount: number };
}

export const useUsers = (f: UserFilters) => {
  const p = new URLSearchParams({ type: "multiple", page: String(f.page), limit: String(USERS_PER_PAGE) });
  if (f.search) p.set("search", f.search);
  if (f.role) p.set("globalRole", f.role);
  if (f.status) p.set("status", f.status);
  return useQuery({ queryKey: ["users", p.toString()], queryFn: () => api<UserList>(`/users?${p}`), placeholderData: keepPreviousData });
};

export interface UserUpdate {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  globalRole?: RoleName | null;
  departmentId?: string | null;
  divisionId?: string | null;
}

export interface NewUser extends UserUpdate {
  firstName: string;
  lastName: string;
  email: string;
}

/** Every write on a user refetches the list, so the table and the open dialog agree. */
function useUserWrite<V>(send: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: send, onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }) });
}

export const useUpdateUser = (id: string) => useUserWrite((body: UserUpdate) => api(`/users/${id}`, { method: "PUT", body }));
export const useSetUserStatus = (id: string) => useUserWrite((status: "active" | "deactivated") => api(`/users/${id}/status`, { method: "PATCH", body: { status } }));
export const useRemoveSessions = (id: string) => useUserWrite(() => api(`/users/${id}/invalidate-sessions`, { method: "POST", body: {} }));
export const useCreateUser = () => useUserWrite((body: NewUser) => api("/users", { method: "POST", body }));
