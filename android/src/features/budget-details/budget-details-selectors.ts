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

/** Past this share of an envelope the remaining amount stops being reassuring. */
const WARNING_THRESHOLD_PERCENT = 50;

export type KindFilter = "all" | TransactionKind;
export type CheckedFilter = "all" | "unchecked" | "checked";

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

/** Which ink the row's amount takes — resolved here so the row holds no rules. */
export type AmountAccent =
  | "income"
  | "savings"
  | "overBudget"
  | "warning"
  | "neutral";

export interface LineItem {
  line: BudgetLine;
  consumption: Consumption;
  /**
   * The one number the row shouts. Expenses surface what is left to spend —
   * the actionable figure — while income and savings surface what has actually
   * landed, because the question there is "did it arrive?", not "how much is
   * left?". An overrun surfaces the overshoot itself.
   */
  displayAmount: number;
  /** The grey caption under it, absent when the amount speaks for itself. */
  amountSuffix: string | null;
  /** The line under the name; empty once the row is pointed. */
  statusLabel: string | null;
  accent: AmountAccent;
  isOverBudget: boolean;
  isChecked: boolean;
}

export interface DetailsSection {
  kind: TransactionKind;
  items: LineItem[];
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
 * `formatAmount` is injected because the suffix quotes a currency the user
 * chose, and the selector has no business knowing which — it only has to
 * produce the same string the row would.
 */
export function detailsSections(
  budgetLines: BudgetLine[],
  transactions: Transaction[],
  filters: DetailsFilters,
  formatAmount: (value: number) => string,
): DetailsSection[] {
  const needle = amountSearchKey(filters.search);

  return KIND_ORDER.filter(
    (kind) => filters.kind === "all" || filters.kind === kind,
  )
    .map((kind) => ({
      kind,
      items: budgetLines
        .filter((line) => line.kind === kind)
        .filter((line) => matchesCheckedFilter(line, filters.checked))
        .filter((line) =>
          matchesSearch(line, transactions, filters.search, needle),
        )
        .map((line) => toLineItem(line, transactions, formatAmount)),
    }))
    .filter((section) => section.items.length > 0);
}

/** Transactions attached to no envelope — they get their own section. */
export function freeTransactions(
  transactions: Transaction[],
  filters: DetailsFilters,
): Transaction[] {
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

/**
 * What each kind filter would show against the *checked* filter already in
 * force — so a chip reading "0" is the truth about what tapping it does.
 */
export function kindCounts(
  budgetLines: BudgetLine[],
  checked: CheckedFilter,
): KindCounts {
  const visible = budgetLines.filter((line) =>
    matchesCheckedFilter(line, checked),
  );

  return {
    all: visible.length,
    income: visible.filter((line) => line.kind === "income").length,
    saving: visible.filter((line) => line.kind === "saving").length,
    expense: visible.filter((line) => line.kind === "expense").length,
  };
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

function toLineItem(
  line: BudgetLine,
  transactions: Transaction[],
  formatAmount: (value: number) => string,
): LineItem {
  const consumption = BudgetFormulas.calculateConsumption(line, transactions);
  const isOverBudget = line.kind === "expense" && consumption.available < 0;

  return {
    line,
    consumption,
    displayAmount: displayAmount(line, consumption, isOverBudget),
    amountSuffix: amountSuffix(line, consumption, isOverBudget, formatAmount),
    statusLabel: statusLabel(line, consumption, isOverBudget, formatAmount),
    accent: amountAccent(line, consumption, isOverBudget),
    isOverBudget,
    isChecked: line.checkedAt !== null,
  };
}

function displayAmount(
  line: BudgetLine,
  consumption: Consumption,
  isOverBudget: boolean,
): number {
  if (line.kind === "expense") {
    if (isOverBudget) return consumption.allocated - line.amount;
    return consumption.allocated > 0 ? consumption.available : line.amount;
  }
  return consumption.allocated > 0 ? consumption.allocated : line.amount;
}

function amountSuffix(
  line: BudgetLine,
  consumption: Consumption,
  isOverBudget: boolean,
  formatAmount: (value: number) => string,
): string | null {
  if (line.kind === "expense") {
    if (isOverBudget) return "de dépassement";
    if (consumption.allocated === 0) return "prévu";
    if (consumption.allocated === line.amount) return null;
    return `restant sur ${formatAmount(line.amount)}`;
  }
  if (consumption.allocated > 0 && consumption.allocated < line.amount) {
    return `/ ${formatAmount(line.amount)} prévu`;
  }
  return null;
}

/**
 * A pointed row says nothing: the ring already carries that. The rest mirrors
 * `BudgetLineMixedRow.subtitleView` — a partial figure only, never a repeat of
 * the amount the row is already printing.
 */
function statusLabel(
  line: BudgetLine,
  consumption: Consumption,
  isOverBudget: boolean,
  formatAmount: (value: number) => string,
): string | null {
  if (line.checkedAt !== null) return null;

  const hasReal = consumption.allocated > 0;
  if (line.kind === "income") {
    if (!hasReal) return null;
    return consumption.allocated >= line.amount
      ? "Reçu"
      : `${formatAmount(consumption.available)} à recevoir`;
  }
  if (line.kind === "saving") {
    if (!hasReal) return null;
    return consumption.allocated >= line.amount
      ? "Transféré"
      : `${formatAmount(consumption.available)} à transférer`;
  }
  return isOverBudget ? "Budget dépassé" : null;
}

/**
 * Income and savings keep their own ink even past plan — an over-received
 * salary is good news. The overrun red belongs to expenses alone.
 */
function amountAccent(
  line: BudgetLine,
  consumption: Consumption,
  isOverBudget: boolean,
): AmountAccent {
  if (line.kind === "income") return "income";
  if (line.kind === "saving") return "savings";
  if (isOverBudget) return "overBudget";
  return consumption.percentage >= WARNING_THRESHOLD_PERCENT
    ? "warning"
    : "neutral";
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
