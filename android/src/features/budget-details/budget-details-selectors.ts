import {
  type BudgetLine,
  BudgetFormulas,
  type Consumption,
  type Transaction,
  type TransactionKind,
} from "pulpe-shared";

/** Section order on the screen, from `FiltersStore.displayedSections`. */
const KIND_ORDER: TransactionKind[] = ["income", "saving", "expense"];

const PERCENT = 100;

const CENTIMES_PER_UNIT = 100;

export type KindFilter = "all" | TransactionKind;
/** `over`: expenses whose movements went past the planned amount. */
export type CheckedFilter = "all" | "unchecked" | "checked" | "over";

export interface DetailsFilters {
  kind: KindFilter;
  checked: CheckedFilter;
  search: string;
}

export const DEFAULT_FILTERS: DetailsFilters = {
  kind: "all",
  checked: "unchecked",
  search: "",
};

/**
 * The row's second line when something is being consumed, mirroring
 * `BudgetLineRowPresentation`. Absent, the row names where the line comes from.
 */
export type ConsumedSubtitle =
  | { kind: "overrun"; amount: number }
  | { kind: "remaining"; amount: number };

export interface LineItem {
  line: BudgetLine;
  consumption: Consumption;
  /** max(planned, spent): what the row prints. */
  shownAmount: number;
  consumed: ConsumedSubtitle | null;
  isOverBudget: boolean;
  isChecked: boolean;
}

export interface DetailsSection {
  kind: TransactionKind;
  items: LineItem[];
}

export interface CheckedCounts {
  unchecked: number;
  all: number;
  over: number;
}

export interface KindCounts {
  all: number;
  income: number;
  saving: number;
  expense: number;
}

/**
 * Sections, filtered and pre-shaped. A kind with nothing left to show is
 * dropped rather than rendered as an empty header.
 *
 * Copy and amount formatting stay at the presentation boundary.
 */
export function detailsSections(
  budgetLines: BudgetLine[],
  transactions: Transaction[],
  filters: DetailsFilters,
): DetailsSection[] {
  const needle = amountSearchKey(filters.search);

  return KIND_ORDER.filter(
    (kind) => filters.kind === "all" || filters.kind === kind,
  )
    .map((kind) => ({
      kind,
      items: budgetLines
        .filter((line) => line.kind === kind)
        .filter((line) =>
          matchesLineFilter(line, transactions, filters.checked),
        )
        .filter((line) =>
          matchesSearch(line, transactions, filters.search, needle),
        )
        .map((line) => toLineItem(line, transactions)),
    }))
    .filter((section) => section.items.length > 0);
}

/** Transactions attached to no envelope — they get their own section. */
export function freeTransactions(
  transactions: Transaction[],
  filters: DetailsFilters,
): Transaction[] {
  if (filters.checked === "over") return [];
  const needle = amountSearchKey(filters.search);

  return transactions
    .filter((transaction) => transaction.budgetLineId === null)
    .filter((transaction) => matchesCheckedFilter(transaction, filters.checked))
    .filter(
      (transaction) =>
        filters.search === "" ||
        containsIgnoringCase(transaction.name, filters.search) ||
        amountMatches(transaction.amount, needle),
    )
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
}

export interface PointedAllocatedItem {
  transaction: Transaction;
  envelopeName: string;
}

/**
 * Under "Pointé", pointed operations whose envelope is still to point: the
 * envelope is filtered out, so nothing else on the screen surfaces them. Those
 * under a pointed envelope stay out — its row already stands for them.
 */
export function pointedAllocatedTransactions(
  budgetLines: BudgetLine[],
  transactions: Transaction[],
  filters: DetailsFilters,
): PointedAllocatedItem[] {
  if (filters.checked !== "checked") return [];
  const needle = amountSearchKey(filters.search);
  const lineById = new Map(budgetLines.map((line) => [line.id, line]));

  return transactions
    .flatMap((transaction) => {
      const line =
        transaction.budgetLineId === null
          ? undefined
          : lineById.get(transaction.budgetLineId);
      if (line === undefined) return [];
      if (transaction.checkedAt === null || line.checkedAt !== null) return [];
      if (filters.kind !== "all" && line.kind !== filters.kind) return [];
      const matchesSearch =
        filters.search === "" ||
        containsIgnoringCase(transaction.name, filters.search) ||
        containsIgnoringCase(line.name, filters.search) ||
        amountMatches(transaction.amount, needle);
      return matchesSearch ? [{ transaction, envelopeName: line.name }] : [];
    })
    .sort((a, b) =>
      b.transaction.transactionDate.localeCompare(
        a.transaction.transactionDate,
      ),
    );
}

/**
 * What each kind filter would show against the *checked* filter already in
 * force — so a chip reading "0" is the truth about what tapping it does.
 */
export function kindCounts(
  budgetLines: BudgetLine[],
  transactions: Transaction[],
  checked: CheckedFilter,
): KindCounts {
  const visible = budgetLines.filter((line) =>
    matchesLineFilter(line, transactions, checked),
  );

  return {
    all: visible.length,
    income: visible.filter((line) => line.kind === "income").length,
    saving: visible.filter((line) => line.kind === "saving").length,
    expense: visible.filter((line) => line.kind === "expense").length,
  };
}

/**
 * What each state chip would show given the kind filter in force — the rail
 * `BudgetTypeFilter` counts "À pointer" and "Dépassées" the same way.
 */
export function checkedCounts(
  budgetLines: BudgetLine[],
  transactions: Transaction[],
  kind: KindFilter,
): CheckedCounts {
  const lines = budgetLines.filter(
    (line) => kind === "all" || line.kind === kind,
  );
  const count = (checked: CheckedFilter) =>
    lines.filter((line) => matchesLineFilter(line, transactions, checked))
      .length;

  return {
    unchecked: count("unchecked"),
    all: lines.length,
    over: count("over"),
  };
}

/** An expense whose movements went past what was planned for it. */
export function isOverrun(
  line: BudgetLine,
  transactions: Transaction[],
): boolean {
  return (
    line.kind === "expense" &&
    Math.round(
      BudgetFormulas.calculateConsumption(line, transactions).available *
        CENTIMES_PER_UNIT,
    ) < 0
  );
}

/**
 * How much of what the month had to spend has been spent. Port of the
 * `BudgetFormulas.Metrics.usagePercentage` computed property, which is Swift's
 * alone — `shared/src/calculators/budget-formulas.ts` computes the same ratio
 * inside `emotionState` but does not expose it. Nothing is stored from it: it
 * drives the hero's bar.
 */
export function budgetUsagePercentage(metrics: {
  totalExpenses: number;
  available: number;
}): number {
  if (metrics.available <= 0) return 0;
  return (metrics.totalExpenses / metrics.available) * PERCENT;
}

function toLineItem(line: BudgetLine, transactions: Transaction[]): LineItem {
  const consumption = BudgetFormulas.calculateConsumption(line, transactions);
  const isOverBudget = isOverrun(line, transactions);

  return {
    line,
    consumption,
    shownAmount: Math.max(line.amount, consumption.allocated),
    consumed: consumedSubtitle(line, consumption, isOverBudget),
    isOverBudget,
    isChecked: line.checkedAt !== null,
  };
}

function consumedSubtitle(
  line: BudgetLine,
  consumption: Consumption,
  isOverBudget: boolean,
): ConsumedSubtitle | null {
  if (line.kind !== "expense") return null;
  if (isOverBudget) {
    return { kind: "overrun", amount: consumption.allocated - line.amount };
  }
  return consumption.allocated > 0 && line.amount > 0
    ? { kind: "remaining", amount: consumption.available }
    : null;
}

function matchesCheckedFilter(
  item: { checkedAt: string | null },
  filter: CheckedFilter,
): boolean {
  if (filter === "all") return true;
  return filter === "checked"
    ? item.checkedAt !== null
    : item.checkedAt === null;
}

function matchesLineFilter(
  line: BudgetLine,
  transactions: Transaction[],
  filter: CheckedFilter,
): boolean {
  return filter === "over"
    ? isOverrun(line, transactions)
    : matchesCheckedFilter(line, filter);
}

/** A line answers a search through its own name, its amount, or its spending. */
function matchesSearch(
  line: BudgetLine,
  transactions: Transaction[],
  search: string,
  needle: string,
): boolean {
  if (search === "") return true;
  if (containsIgnoringCase(line.name, search)) return true;
  if (amountMatches(line.amount, needle)) return true;

  return transactions.some(
    (transaction) =>
      transaction.budgetLineId === line.id &&
      (containsIgnoringCase(transaction.name, search) ||
        amountMatches(transaction.amount, needle)),
  );
}

function containsIgnoringCase(haystack: string, needle: string): boolean {
  return haystack.toLocaleLowerCase().includes(needle.toLocaleLowerCase());
}

/**
 * Reduces what the user typed to bare digits so the grouping separator and the
 * decimal comma never stand between them and the row: `1’500`, `1 500,00` and
 * `1500` all become `1500`. Empty when nothing was a digit, so a lone space
 * cannot match every amount on the screen.
 */
function amountSearchKey(text: string): string {
  const key = text.replace(",", ".").replace(/[^\d.]/g, "");
  return /\d/.test(key) ? key : "";
}

function amountMatches(amount: number, needle: string): boolean {
  return needle !== "" && amount.toFixed(2).includes(needle);
}
