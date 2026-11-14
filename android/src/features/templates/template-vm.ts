import {
  BudgetFormulas,
  compareBudgetPeriods,
  getBudgetPeriodForDate,
  type TemplateLine,
  type TemplateUsageResponse,
  type TransactionKind,
} from "pulpe-shared";

import {
  type DisponibleImpact,
  impactBetween,
  type MonthLedger,
} from "@/features/budget-details/month-impact";

/** Same ceiling as iOS (`AppConfiguration.maxTemplates`). */
export const MAX_TEMPLATES = 5;

export type TemplateUsage = TemplateUsageResponse["data"];

/** Income first, then what leaves — the order every other screen reads in. */
const SECTION_ORDER: TransactionKind[] = ["income", "expense", "saving"];

export interface TemplateLineSection {
  kind: TransactionKind;
  lines: TemplateLine[];
  total: number;
}

export function templateLineSections(
  lines: TemplateLine[],
): TemplateLineSection[] {
  return SECTION_ORDER.map((kind) => {
    const section = lines.filter((line) => line.kind === kind);
    return {
      kind,
      lines: section,
      total: section.reduce((total, line) => total + line.amount, 0),
    };
  }).filter((section) => section.lines.length > 0);
}

/**
 * How many budgets an edit would actually reach.
 *
 * A model can have generated budgets for periods already gone; propagation only
 * touches the current period and the ones after it, so announcing the raw usage
 * count would overstate what the user is about to change. The current period
 * follows the user's payday, not the calendar month.
 */
export function propagationBudgetCount(
  usage: TemplateUsage,
  payDayOfMonth: number | null | undefined,
  now = new Date(),
): number {
  const current = getBudgetPeriodForDate(now, payDayOfMonth);

  return usage.budgets.filter(
    (budget) => compareBudgetPeriods(budget, current) >= 0,
  ).length;
}

export function canCreateTemplate(templateCount: number): boolean {
  return templateCount < MAX_TEMPLATES;
}

/**
 * The current period when its budget was built from this model, so the
 * propagation step can speak of « novembre » rather than « tes mois déjà
 * créés ». Null when the month does not follow the model.
 */
export function propagationCurrentPeriod(
  usage: TemplateUsage,
  payDayOfMonth: number | null | undefined,
  now = new Date(),
): { month: number; year: number } | null {
  const current = getBudgetPeriodForDate(now, payDayOfMonth);
  return usage.budgets.some(
    (budget) => compareBudgetPeriods(budget, current) === 0,
  )
    ? current
    : null;
}

/** What a model leaves to spend at the start of a month: its lines' balance. */
export function templateAvailable(lines: TemplateLine[]): number {
  return BudgetFormulas.calculateTemplateTotals(lines).balance;
}

/**
 * The current month's « disponible » before and after the edited model line
 * reaches it. Null when the month holds no copy of the line that follows the
 * model (never built from it, or changed by hand there): nothing would move.
 */
export function propagationAvailableImpact(
  ledger: MonthLedger,
  templateLineId: string,
  edit: { amount: number; kind: TransactionKind },
): DisponibleImpact | null {
  const monthLine = ledger.lines.find(
    (line) =>
      line.templateLineId === templateLineId && !line.isManuallyAdjusted,
  );
  if (monthLine === undefined) return null;
  return impactBetween(ledger, {
    ...ledger,
    lines: ledger.lines.map((line) =>
      line.id === monthLine.id ? { ...line, ...edit } : line,
    ),
  });
}
