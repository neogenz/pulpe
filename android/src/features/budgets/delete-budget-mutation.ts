import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";
import { goalKeys } from "@/features/savings-goals/goals-queries";
import { templateKeys } from "@/features/templates/template-queries";

import { budgetKeys } from "./budget-queries";

/**
 * `confirmLinks` is the user's answer to the impact read: the server refuses a
 * linked month without it, and deletes nothing.
 */
export function useDeleteBudget(budgetId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (confirmLinks: boolean) =>
      api.deleteVoid(ENDPOINTS.budget(budgetId), { confirmLinks }),
    // The list, periods and template usage lose a month, and a spread or a
    // goal lost its share.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: budgetKeys.all,
          // ponytail: the deleted month's detail (key index 2) stays out of the
          // sweep, its screen is still mounted and a refetch would 404.
          predicate: (query) => query.queryKey[2] !== budgetId,
        }),
        queryClient.invalidateQueries({ queryKey: goalKeys.all }),
        queryClient.invalidateQueries({ queryKey: templateKeys.all }),
      ]),
  });
}
