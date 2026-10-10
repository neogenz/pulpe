import { useMutation, useQueryClient } from "@tanstack/react-query";

import { goalKeys } from "@/features/savings-goals/goals-queries";
import { templateKeys } from "@/features/templates/template-queries";

import { generateBudgets } from "./budget-api";
import { budgetKeys } from "./budget-queries";

export function useGenerateBudgets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateBudgets,
    // The new lines carry their template line's goal, and the template its usage.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: budgetKeys.all }),
        queryClient.invalidateQueries({ queryKey: goalKeys.all }),
        queryClient.invalidateQueries({ queryKey: templateKeys.all }),
      ]),
  });
}
