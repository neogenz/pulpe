import type { SpreadOccurrence } from "pulpe-shared";

import {
  spreadOccurrenceItems,
  spreadRealizedAmount,
  spreadTracker,
} from "./spread-progress";

const VIEWED = { year: 2026, month: 8 };
const LIVE = { year: 2026, month: 8 };

function occurrence(
  overrides: Partial<SpreadOccurrence> & { month: number },
): SpreadOccurrence {
  return {
    budgetLineId: `line-${overrides.month}`,
    budgetId: `budget-${overrides.month}`,
    year: 2026,
    name: "Impôts",
    amount: 300,
    kind: "expense",
    checkedAt: null,
    consumed: 0,
    transactionCount: 0,
    ...overrides,
  };
}

describe("spreadOccurrenceItems", () => {
  it("orders the months and marks where the reader stands", () => {
    const items = spreadOccurrenceItems(
      [
        occurrence({ month: 9 }),
        occurrence({ month: 7 }),
        occurrence({ month: 8 }),
      ],
      VIEWED,
      LIVE,
    );

    expect(items.map((item) => item.occurrence.month)).toEqual([7, 8, 9]);
    expect(items.map((item) => item.isPast)).toEqual([true, false, false]);
    expect(items.map((item) => item.isViewed)).toEqual([false, true, false]);
  });

  // The viewed month and the month being lived in are different axes: reading
  // last month's budget must not turn its own occurrence into a future one.
  it("keeps past against the live month, not the viewed one", () => {
    const items = spreadOccurrenceItems(
      [occurrence({ month: 7 })],
      { year: 2026, month: 6 },
      LIVE,
    );

    expect(items[0].isPast).toBe(true);
    expect(items[0].isBeforeViewed).toBe(false);
  });
});

describe("spreadRealizedAmount", () => {
  it("prefers what was really spent", () => {
    const [item] = spreadOccurrenceItems(
      [occurrence({ month: 7, consumed: 280, transactionCount: 2 })],
      VIEWED,
      LIVE,
    );

    expect(spreadRealizedAmount(item)).toBe(280);
  });

  it("falls back to the tranche when nothing was booked", () => {
    const [item] = spreadOccurrenceItems(
      [occurrence({ month: 7 })],
      VIEWED,
      LIVE,
    );

    expect(spreadRealizedAmount(item)).toBe(300);
  });
});

describe("spreadTracker", () => {
  it("counts a past month as provisioned and shares the rest over the open ones", () => {
    const items = spreadOccurrenceItems(
      [
        occurrence({ month: 7 }),
        occurrence({ month: 8 }),
        occurrence({ month: 9 }),
      ],
      VIEWED,
      LIVE,
    );
    const tracker = spreadTracker(items);

    expect(tracker?.totalAmount).toBe(900);
    expect(tracker?.cumulatedAmount).toBe(300);
    expect(tracker?.currentIndex).toBe(2);
    expect(tracker?.remainingToProvision).toBe(600);
    expect(tracker?.perRemainingMonth).toBe(300);
  });

  // A pointed month is done: counting it in the total AND as a slot still to
  // fill would ask the user to provision it twice.
  it("never counts a pointed month as still open", () => {
    const items = spreadOccurrenceItems(
      [
        occurrence({ month: 8, checkedAt: "2026-08-05T00:00:00.000Z" }),
        occurrence({ month: 9 }),
      ],
      VIEWED,
      LIVE,
    );
    const tracker = spreadTracker(items);

    expect(tracker?.cumulatedAmount).toBe(300);
    expect(tracker?.perRemainingMonth).toBe(300);
  });

  it("says nothing is left when everything is behind", () => {
    const items = spreadOccurrenceItems(
      [occurrence({ month: 6 }), occurrence({ month: 7 })],
      VIEWED,
      LIVE,
    );
    const tracker = spreadTracker(items);

    expect(tracker?.remainingToProvision).toBe(0);
    expect(tracker?.perRemainingMonth).toBeNull();
    expect(tracker?.progressPercent).toBe(100);
  });

  it("has nothing to track without occurrences", () => {
    expect(spreadTracker([])).toBeNull();
  });
});
