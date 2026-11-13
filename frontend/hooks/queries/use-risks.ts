import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Department, Risk } from "@/lib/risk";

export const useRisks = (departmentId: string, month: string) =>
  useQuery({
    queryKey: ["risks", { departmentId, month }],
    queryFn: () => api<Risk[]>(`/risks?${new URLSearchParams({ departmentId, month })}`),
  });

export const useDepartments = () =>
  useQuery({ queryKey: ["departments"], queryFn: () => api<Department[]>("/departments") });
