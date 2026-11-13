import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { RegisterSummary } from "@/lib/risk";

export const useRegisters = () => useQuery({ queryKey: ["risk-registers"], queryFn: () => api<RegisterSummary[]>("/risks/registers") });

/** Same shape as a register, but counting the risks that affect each department rather than the ones it owns. */
export const useDivisions = () => useQuery({ queryKey: ["risk-divisions"], queryFn: () => api<RegisterSummary[]>("/risks/divisions") });
