import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { ActivityItem, Analytics, Attachment, HistoryVersion, Plan, RiskDetail } from "@/lib/risk-detail";

const key = (id: string, ...rest: string[]) => ["risk", id, ...rest];

export const useRiskDetail = (id: string) => useQuery({ queryKey: key(id), queryFn: () => api<RiskDetail>(`/risks/${id}`), retry: false });
export const useActivity = (id: string) => useQuery({ queryKey: key(id, "activity"), queryFn: () => api<ActivityItem[]>(`/risks/${id}/activity`) });
export const usePlans = (id: string) => useQuery({ queryKey: key(id, "plans"), queryFn: () => api<Plan[]>(`/risks/${id}/actions`) });
export const useAnalytics = (id: string, range: "year" | "all") =>
  useQuery({ queryKey: key(id, "analytics", range), queryFn: () => api<Analytics>(`/risks/${id}/analytics?range=${range}`) });
export const useDescriptionHistory = (id: string, enabled: boolean) =>
  useQuery({ queryKey: key(id, "description-history"), queryFn: () => api<HistoryVersion[]>(`/risks/${id}/description-history`), enabled });
export const useCommentHistory = (id: string, commentId: string, enabled: boolean) =>
  useQuery({ queryKey: key(id, "comment-history", commentId), queryFn: () => api<HistoryVersion[]>(`/risks/${id}/comments/${commentId}/history`), enabled });

/** One mutation shape for every write on a risk: send it, then refetch everything under ["risk", id] and the register lists. */
function useWrite<V>(id: string, send: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: key(id) }), qc.invalidateQueries({ queryKey: ["risks"] }), qc.invalidateQueries({ queryKey: ["risk-register"] }), qc.invalidateQueries({ queryKey: ["dashboard"] })]),
  });
}

export const usePatchRisk = (id: string) =>
  useWrite(id, (body: Record<string, unknown>) => api(`/risks/${id}`, { method: "PATCH", body }));
export const useRiskCommand = (id: string, command: "review" | "close" | "reopen" | "archive" | "unarchive" | "transfer") =>
  useWrite(id, (body?: { departmentId: string }) => api(`/risks/${id}/${command}`, { method: "POST", body: body ?? {} }));
export const useAddComment = (id: string) =>
  useWrite(id, (body: { body: string; attachmentIds: string[] }) => api(`/risks/${id}/comments`, { method: "POST", body }));
export const useEditComment = (id: string) =>
  useWrite(id, (v: { commentId: string; body: string }) => api(`/risks/${id}/comments/${v.commentId}`, { method: "PATCH", body: { body: v.body } }));
export const useSavePlan = (id: string) =>
  useWrite(id, (v: { planId?: string; body: Record<string, unknown> }) =>
    v.planId ? api(`/risks/${id}/actions/${v.planId}`, { method: "PATCH", body: v.body }) : api(`/risks/${id}/actions`, { method: "POST", body: v.body }),
  );

export const uploadAttachment = (id: string, file: File) =>
  new Promise<Attachment>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () =>
      api<Attachment>(`/risks/${id}/attachments`, { method: "POST", body: { name: file.name, mimeType: file.type || "application/octet-stream", data: reader.result } }).then(resolve, reject);
    reader.readAsDataURL(file);
  });
