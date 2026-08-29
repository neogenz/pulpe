import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useVaultStore } from "@/core/vault/vault-store";
import { budgetKeys } from "@/features/budgets/budget-queries";

import {
  bulkTemplateLines,
  createTemplate,
  createTemplateLine,
  deleteTemplate,
  deleteTemplateLine,
  fetchTemplate,
  fetchTemplateLines,
  fetchTemplates,
  fetchTemplateUsage,
  updateTemplate,
  updateTemplateLine,
} from "./template-api";

export const templateKeys = {
  all: ["templates"] as const,
  list: () => ["templates", "list"] as const,
  detail: (templateId: string) => ["templates", "detail", templateId] as const,
  lines: (templateId: string) => ["templates", "lines", templateId] as const,
  usage: (templateId: string) => ["templates", "usage", templateId] as const,
};

function useUnlocked(): boolean {
  return useVaultStore((state) => state.status === "unlocked");
}

export function useTemplates() {
  const isUnlocked = useUnlocked();

  return useQuery({
    queryKey: templateKeys.list(),
    queryFn: fetchTemplates,
    enabled: isUnlocked,
  });
}

export function useTemplate(templateId: string) {
  const isUnlocked = useUnlocked();

  return useQuery({
    queryKey: templateKeys.detail(templateId),
    queryFn: () => fetchTemplate(templateId),
    enabled: isUnlocked,
  });
}

export function useTemplateLines(templateId: string) {
  const isUnlocked = useUnlocked();

  return useQuery({
    queryKey: templateKeys.lines(templateId),
    queryFn: () => fetchTemplateLines(templateId),
    enabled: isUnlocked,
  });
}

export function useTemplateUsage(templateId: string) {
  const isUnlocked = useUnlocked();

  return useQuery({
    queryKey: templateKeys.usage(templateId),
    queryFn: () => fetchTemplateUsage(templateId),
    enabled: isUnlocked,
  });
}

/**
 * A model edit can reach the budgets generated from it, and none of these
 * inputs carries a budget id, so the budget prefix is swept rather than
 * narrowed with `invalidateBudget`.
 */
function useTemplateMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: templateKeys.all });
      void queryClient.invalidateQueries({ queryKey: budgetKeys.all });
    },
  });
}

export function useCreateTemplate() {
  return useTemplateMutation(createTemplate);
}

export function useUpdateTemplate() {
  return useTemplateMutation(updateTemplate);
}

export function useDeleteTemplate() {
  return useTemplateMutation(deleteTemplate);
}

export function useCreateTemplateLine() {
  return useTemplateMutation(createTemplateLine);
}

export function useUpdateTemplateLine() {
  return useTemplateMutation(updateTemplateLine);
}

export function useDeleteTemplateLine() {
  return useTemplateMutation(deleteTemplateLine);
}

export function useBulkTemplateLines() {
  return useTemplateMutation(bulkTemplateLines);
}
