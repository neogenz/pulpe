import {
  compareBudgetPeriods,
  getBudgetPeriodForDate,
  type TemplateLine,
  type TemplateUsageResponse,
  type TransactionKind,
} from "pulpe-shared";

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
