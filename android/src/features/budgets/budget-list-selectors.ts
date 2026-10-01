import type { BudgetSparse } from "pulpe-shared";

export interface BudgetYearSection {
  year: number;
  budgets: BudgetSparse[];
}

/**
 * Infinite pages can overlap when a write lands between two offset requests.
 * Keep the first occurrence so the already visible month stays stable while
 * the newly loaded history is appended.
 */
export function uniqueBudgets(pages: BudgetSparse[][]): BudgetSparse[] {
  const seen = new Set<string>();
  return pages.flat().filter((budget) => {
    if (seen.has(budget.id)) return false;
    seen.add(budget.id);
    return true;
  });
}

/**
 * The list as it reads: newest year first, newest month first inside it, and
 * the year the user is living in at the top whatever the calendar says — a
 * future budget belongs above the past, not after it.
 *
 * Budgets with no period are dropped rather than bucketed under a placeholder
 * year: the sparse fieldset makes both fields optional, and a row that names no
 * month cannot be opened to anything meaningful.
 */
export function budgetYearSections(
  budgets: BudgetSparse[],
): BudgetYearSection[] {
  const byYear = new Map<number, BudgetSparse[]>();

  for (const budget of budgets) {
    if (budget.month === undefined || budget.year === undefined) continue;
    const rows = byYear.get(budget.year);
    if (rows === undefined) {
      byYear.set(budget.year, [budget]);
      continue;
    }
    rows.push(budget);
  }

  return [...byYear.entries()]
    .sort(([left], [right]) => right - left)
    .map(([year, rows]) => ({
      year,
      budgets: [...rows].sort((a, b) => (b.month ?? 0) - (a.month ?? 0)),
    }));
}

/** Where a budget sits relative to the month being lived in. */
export type BudgetTiming = "past" | "current" | "future";

export interface Period {
  year: number;
  month: number;
}

/**
 * Which of the three a month is. The list mixes all three in one scroll, and
 * they are not read the same way: the current month is the one being acted on,
 * a future one is a plan, a past one is a record. Without this they were
 * twenty identical grey cards and the user had to read the dates to find today.
 */
export function budgetTiming(
  budget: Pick<BudgetSparse, "month" | "year">,
  current: Period,
): BudgetTiming {
  const year = budget.year ?? current.year;
  const month = budget.month ?? current.month;
  if (year === current.year && month === current.month) return "current";
  return year < current.year || (year === current.year && month < current.month)
    ? "past"
    : "future";
}

/** Where a row sits in the sectioned list, and how much of the list precedes it. */
export interface BudgetListLocation {
  sectionIndex: number;
  itemIndex: number;
  /**
   * Rows above it, year headers counted — a section header occupies a row of the
   * virtualiser just as a card does. It is what says how far the first render
   * has to reach for the row to exist by the time the list is asked to show it.
   */
  rowsAbove: number;
}

/**
 * Where the list should open, or `null` when there is nothing to move to.
 *
 * The list reads newest first, so what buries the month being lived in is the
 * *plans* above it: an account provisioned a year ahead opens twelve cards away
 * from the only month anyone can act on today. Null covers the two cases where
 * moving would be noise — the current month has no budget, and it is already the
 * first row.
 */
export function currentBudgetLocation(
  sections: BudgetYearSection[],
  current: Period,
): BudgetListLocation | null {
  let rows = 0;

  for (const [sectionIndex, section] of sections.entries()) {
    rows += 1; // this section's year header
    for (const [itemIndex, budget] of section.budgets.entries()) {
      if (budgetTiming(budget, current) !== "current") continue;
      if (sectionIndex === 0 && itemIndex === 0) return null;
      return { sectionIndex, itemIndex, rowsAbove: rows + itemIndex };
    }
    rows += section.budgets.length;
  }

  return null;
}

/**
 * The same budgets read the other way round — oldest first, across years. The
 * month pager runs left to right like a calendar, where the list reads newest
 * first like a feed.
 */
export function budgetsInPeriodOrder(budgets: BudgetSparse[]): BudgetSparse[] {
  return budgets
    .filter((budget) => budget.month !== undefined && budget.year !== undefined)
    .sort(
      (a, b) =>
        (a.year ?? 0) - (b.year ?? 0) || (a.month ?? 0) - (b.month ?? 0),
    );
}

const MONTHS_PER_YEAR = 12;

/** Every year with at least one budget, oldest first — the year picker's chips. */
export function budgetYears(budgets: BudgetSparse[]): number[] {
  const years = new Set<number>();
  for (const budget of budgets) {
    if (budget.year !== undefined && budget.month !== undefined) {
      years.add(budget.year);
    }
  }
  return [...years].sort((left, right) => left - right);
}

/**
 * The year a list opens on: the one being lived in when it has a budget, the
 * latest one otherwise — `BudgetListView.swift` makes the same choice, so a
 * user who planned only next year does not land on an empty one.
 */
export function initialBudgetYear(years: number[], current: Period): number {
  if (years.includes(current.year)) return current.year;
  return years.at(-1) ?? current.year;
}

/** One year's months, January first, like a calendar. */
export function budgetsOfYear(
  budgets: BudgetSparse[],
  year: number,
): BudgetSparse[] {
  return budgets
    .filter((budget) => budget.year === year && budget.month !== undefined)
    .sort((left, right) => (left.month ?? 0) - (right.month ?? 0));
}

export interface YearRecap {
  /** What the year closes on: its last month's remaining, carry-overs included. */
  closingBalance: number;
  budgetedMonths: number;
}

export function yearRecap(yearBudgets: BudgetSparse[]): YearRecap {
  return {
    closingBalance: yearBudgets.at(-1)?.remaining ?? 0,
    budgetedMonths: yearBudgets.length,
  };
}

/**
 * The first month still missing a budget from today on, in the year being
 * read — the one placeholder iOS draws so the next step is in the list rather
 * than behind a toolbar icon. Nothing for a year already behind us.
 */
export function nextMissingMonth(
  yearBudgets: BudgetSparse[],
  year: number,
  current: Period,
): number | null {
  if (year < current.year) return null;
  const taken = new Set(yearBudgets.map((budget) => budget.month));
  const first = year === current.year ? current.month : 1;
  for (let month = first; month <= MONTHS_PER_YEAR; month += 1) {
    if (!taken.has(month)) return month;
  }
  return null;
}
