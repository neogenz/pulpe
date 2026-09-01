import { useMutation, useQueryClient } from "@tanstack/react-query";

import { generateBudgets } from "./budget-api";
import { budgetKeys } from "./budget-queries";

export function useGenerateBudgets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateBudgets,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: budgetKeys.all }),
  });
}
