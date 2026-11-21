import { freeRow } from "./reconcile-account-links";
import {
  clearReconcileDraft,
  keepReconcileDraft,
  readReconcileDraft,
} from "./reconcile-draft-store";

afterEach(() => clearReconcileDraft());

it("gives the rows back to the budget they were typed on, and to no other", () => {
  const rows = [{ ...freeRow(0, "own", "Revolut"), amountText: "1000" }];
  keepReconcileDraft("budget-1", rows);

  expect(readReconcileDraft("budget-1")).toEqual(rows);
  expect(readReconcileDraft("budget-2")).toBeNull();
});

it("leaves nothing once cleared", () => {
  keepReconcileDraft("budget-1", [freeRow(0, "own")]);
  clearReconcileDraft();
  expect(readReconcileDraft("budget-1")).toBeNull();
});
