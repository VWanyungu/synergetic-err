import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface FormOptions {
  categories: string[];
  owners: { id: string; name: string }[];
  currentUserId: string | null;
  /** Set for a Risk Champion: the only department they can log risks in. */
  scopedDepartmentId: string | null;
}

export interface NewRisk {
  title: string;
  description: string;
  category: string;
  departmentId: string;
  ownerId: string | null;
  impact: number;
  likelihood: number;
  riskResponse?: string;
  nextReviewDate: string | null;
  divisionIds: string[];
  action: { title: string; ownerId: string | null; dueDate: string | null; status: string } | null;
}

export const useRiskFormOptions = () =>
  useQuery({ queryKey: ["risk-form-options"], queryFn: () => api<FormOptions>("/risks/form-options") });

export const useCreateRisk = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NewRisk) => api<{ id: string; code: string }>("/risks", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["risks"] }),
  });
};
