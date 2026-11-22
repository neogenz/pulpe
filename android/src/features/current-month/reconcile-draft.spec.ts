import { freeRow } from "./reconcile-account-links";
import {
  keepReconcileDraft,
  pendingReconcileResume,
  reconcileDraft,
} from "./reconcile-draft";

afterEach(() => keepReconcileDraft(null));

it("gives the rows back to the budget they were typed on, and to no other", () => {
  const rows = [{ ...freeRow(0, "own", "Revolut"), amountText: "1000" }];
  keepReconcileDraft({ budgetId: "budget-1", rows, hasCompleted: true });

  expect(reconcileDraft("budget-1")).toMatchObject({
    rows,
    hasCompleted: true,
  });
  expect(reconcileDraft("budget-2")).toBeNull();
  expect(pendingReconcileResume()).toBe("budget-1");
});

it("leaves nothing once cleared", () => {
  keepReconcileDraft({
    budgetId: "budget-1",
    rows: [freeRow(0, "own")],
    hasCompleted: false,
  });
  keepReconcileDraft(null);
  expect(reconcileDraft("budget-1")).toBeNull();
  expect(pendingReconcileResume()).toBeNull();
});
