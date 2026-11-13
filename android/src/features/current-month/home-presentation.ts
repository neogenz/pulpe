import type { TranslateOptions } from "i18n-js";
import type {
  BudgetLine,
  Consumption,
  SupportedCurrency,
  Transaction,
  TransactionKind,
} from "pulpe-shared";

import { formatCurrency } from "@/core/ui/amount-format";
import { formatDayMonth, formatRelativeDay } from "@/core/ui/date-format";
import { recurrenceLabel } from "@/core/ui/vocabulary";

import type { PeriodProgress } from "./current-month-view-model";

/**
 * The words of the home and its two pages, kept apart from how they are drawn.
 * Port of `HomeTodoPresentation`, `HomePresentation` and `ToPointPresentation`
 * in Swift.
 */
type Translate = (key: string, options?: TranslateOptions) => string;

/** « Jour 10 sur 31 · jusqu'au 24 novembre ». */
export function periodCaption(
  t: Translate,
  locale: string,
  progress: PeriodProgress,
  periodEnd: Date,
): string {
  return t("home.periodCaption", {
    day: progress.day,
    total: progress.totalDays,
    date: formatDayMonth(periodEnd, locale),
  });
}

/** « Courses et Sorties dépassent »: the two worst overruns, the rest counted. */
export function driftTitle(t: Translate, names: string[]): string {
  switch (names.length) {
    case 0:
      return "";
    case 1:
      return t("home.todo.driftOne", { name: names[0] });
    case 2:
      return t("home.todo.driftTwo", { first: names[0], second: names[1] });
    default:
      return t("home.todo.driftMany", {
        name: names[0],
        count: names.length - 1,
      });
  }
}

/** « Salaire, Loyer et 11 autres prévisions »: what waits on a first month. */
export function startSubtitle(
  t: Translate,
  names: string[],
  total: number,
): string {
  switch (total) {
    case 0:
      return "";
    case 1:
      return names[0] ?? "";
    case 2:
      return t("home.start.pair", { first: names[0], second: names[1] });
    default:
      return t("home.start.many", {
        first: names[0],
        second: names[1],
        count: total - 2,
      });
  }
}

export interface LineFact {
  text: string;
  isOverrun: boolean;
  /** The text prints an amount, so it leaves the row while amounts are hidden. */
  hasAmount: boolean;
}

/**
 * A forecast's one fact: how far past its plan it ran, what is left of it once
 * movements were counted in it, else its rhythm (a saving says so first).
 */
export function lineFact(
  t: Translate,
  line: Pick<BudgetLine, "kind" | "recurrence" | "spreadGroupId">,
  consumption: Consumption,
  currency: SupportedCurrency,
): LineFact {
  if (consumption.available < 0) {
    return {
      text: t("home.toPoint.over", {
        amount: formatCurrency(-consumption.available, currency),
      }),
      isOverrun: true,
      hasAmount: true,
    };
  }
  if (consumption.allocated > 0) {
    return {
      text: t("home.toPoint.left", {
        amount: formatCurrency(consumption.available, currency),
      }),
      isOverrun: false,
      hasAmount: true,
    };
  }
  const rhythm =
    line.spreadGroupId == null
      ? recurrenceLabel(t, line.recurrence)
      : t("budgets.detail.spread");
  return {
    text:
      line.kind === "saving" ? t("home.toPoint.saving", { rhythm }) : rhythm,
    isOverrun: false,
    hasAmount: false,
  };
}

/** Where a movement was counted: its forecast, else « Hors prévision ». */
export function movementPlace(
  t: Translate,
  kind: TransactionKind,
  lineName: string | undefined,
): string {
  if (lineName !== undefined) return lineName;
  return t(
    kind === "saving" ? "home.movements.saving" : "home.movements.unplanned",
  );
}

/**
 * « Courses · pointé à l'instant », « Hors prévision · Aujourd'hui ». Unlike
 * the home's list, an unallocated saving reads « Hors prévision » here too.
 */
export function toPointMovementFact(
  t: Translate,
  locale: string,
  transaction: Transaction,
  lineName: string | undefined,
  isPointedNow: boolean,
  now: Date,
): string {
  const tail = isPointedNow
    ? t("home.toPoint.pointedNow")
    : formatRelativeDay(new Date(transaction.transactionDate), now, locale);
  return `${lineName ?? t("home.movements.unplanned")} · ${tail}`;
}

/** What a row of the latest movements says under its name. */
export function movementSubtitle(
  t: Translate,
  transaction: Transaction,
  lineName: string | undefined,
): string {
  const place = movementPlace(t, transaction.kind, lineName);
  return transaction.checkedAt === null
    ? place
    : `${place} · ${t("home.movements.pointed")}`;
}

/** Just pointed from the page and still pointed: an undo ends the « à l'instant ». */
export function isPointedNow(
  pointedHere: ReadonlySet<string>,
  id: string,
  isChecked: boolean,
): boolean {
  return pointedHere.has(id) && isChecked;
}

export type MovementsFilter = "all" | "unpointed" | "unplanned";

export const MOVEMENTS_FILTERS: MovementsFilter[] = [
  "all",
  "unpointed",
  "unplanned",
];

function keeps(filter: MovementsFilter, transaction: Transaction): boolean {
  switch (filter) {
    case "all":
      return true;
    case "unpointed":
      return transaction.checkedAt === null;
    case "unplanned":
      return transaction.budgetLineId === null;
  }
}

export function countMovements(
  filter: MovementsFilter,
  transactions: Transaction[],
): number {
  return transactions.filter((transaction) => keeps(filter, transaction))
    .length;
}

function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * What survives the chip and the search. The search reads the movement's own
 * name and the name of its forecast, ignoring case and accents.
 */
export function filterMovements(
  filter: MovementsFilter,
  query: string,
  transactions: Transaction[],
  lineNames: ReadonlyMap<string, string>,
): Transaction[] {
  const needle = fold(query.trim());
  return transactions.filter((transaction) => {
    if (!keeps(filter, transaction)) return false;
    if (needle === "") return true;
    const lineName =
      transaction.budgetLineId === null
        ? ""
        : (lineNames.get(transaction.budgetLineId) ?? "");
    return fold(`${transaction.name}\n${lineName}`).includes(needle);
  });
}
