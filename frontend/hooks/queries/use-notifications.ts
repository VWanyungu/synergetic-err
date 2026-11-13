import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface Notification {
  id: string;
  type: "archive_request" | "archive_approved" | "archive_rejected";
  title: string;
  body: string;
  riskId: string | null;
  riskCode: string | null;
  requestId: string | null;
  /** Live status of the archive request this is about. */
  requestStatus: "pending" | "approved" | "rejected" | null;
  decidedBy: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationList {
  notifications: Notification[];
  unreadCount: number;
}

export const useNotifications = (filter: "all" | "unread") =>
  useQuery({ queryKey: ["notifications", filter], queryFn: () => api<NotificationList>(`/notifications${filter === "unread" ? "?filter=unread" : ""}`) });

/** Drives the bell's badge; polls so a new request shows up without a reload. */
export const useUnreadCount = () =>
  useQuery({ queryKey: ["notifications", "count"], queryFn: () => api<NotificationList>("/notifications?filter=unread"), refetchInterval: 60_000, select: (d) => d.unreadCount });

export const useNotificationActions = () => {
  const qc = useQueryClient();
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["notifications"] }), qc.invalidateQueries({ queryKey: ["risk"] }), qc.invalidateQueries({ queryKey: ["risks"] }), qc.invalidateQueries({ queryKey: ["risk-register"] })]);
  return {
    read: useMutation({ mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: "PATCH" }), onSuccess: refresh }),
    readAll: useMutation({ mutationFn: () => api("/notifications/read-all", { method: "POST" }), onSuccess: refresh }),
    decide: useMutation({
      mutationFn: ({ requestId, outcome }: { requestId: string; outcome: "approve" | "reject" }) => api(`/notifications/requests/${requestId}/${outcome}`, { method: "POST" }),
      onSuccess: refresh,
    }),
  };
};
