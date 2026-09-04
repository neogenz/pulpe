import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type React from "react";

import { budgetKeys } from "./budget-queries";
import { useGenerateBudgets } from "./generate-budgets-mutation";

jest.mock("./budget-api", () => ({
  generateBudgets: jest.fn(async () => ({
    success: true,
    data: { budgets: [], skippedMonths: [] },
  })),
}));
jest.mock("./budget-queries", () => ({
  budgetKeys: { all: ["budgets"] },
}));

it("invalidates the complete budget prefix after generation", async () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  let finishInvalidation!: () => void;
  const invalidate = jest.spyOn(client, "invalidateQueries").mockReturnValue(
    new Promise<void>((resolve) => {
      finishInvalidation = resolve;
    }),
  );
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(() => useGenerateBudgets(), { wrapper });

  let mutation!: Promise<unknown>;
  await act(() => {
    mutation = hook.result.current.mutateAsync({
      templateId: "11111111-2222-3333-4444-555555555555",
      startMonth: 9,
      startYear: 2026,
      count: 12,
    });
  });

  await waitFor(() =>
    expect(invalidate).toHaveBeenCalledWith({ queryKey: budgetKeys.all }),
  );
  expect(hook.result.current.isSuccess).toBe(false);

  await act(async () => {
    finishInvalidation();
    await mutation;
  });
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  await hook.unmount();
  client.clear();
});
