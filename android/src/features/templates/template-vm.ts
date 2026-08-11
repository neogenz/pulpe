import type {
  TemplateLine,
  TemplateUsageResponse,
  TransactionKind,
} from "pulpe-shared";

/** Same ceiling as iOS (`AppConfiguration.maxTemplates`). */
export const MAX_TEMPLATES = 5;

export type TemplateUsage = TemplateUsageResponse["data"];

export interface TemplateTotals {
  income: number;
  outflow: number;
  balance: number;
}

/**
 * What a model plans for a month. Port of `BudgetFormulas.calculateTemplateTotals`,
 * which exists in Swift with no TypeScript twin — the rule belongs in
 * `shared/src/calculators/`, and this is a second copy until it moves there.
 */
export function templateTotals(lines: TemplateLine[]): TemplateTotals {
  const income = sumOf(lines, "income");
  const outflow = sumOf(lines, "expense") + sumOf(lines, "saving");

  return { income, outflow, balance: income - outflow };
}

function sumOf(lines: TemplateLine[], kind: TransactionKind): number {
  return lines
    .filter((line) => line.kind === kind)
    .reduce((total, line) => total + line.amount, 0);
}

export const KIND_SECTION_LABELS: Record<TransactionKind, string> = {
  income: "Revenus",
  expense: "Dépenses",
  saving: "Épargne",
};

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
 * A model can have generated budgets for months already gone; propagation only
 * touches the current month and the ones after it, so announcing the raw usage
 * count would overstate what the user is about to change.
 */
export function propagationBudgetCount(
  usage: TemplateUsage,
  now = new Date(),
): number {
  const current = now.getFullYear() * 12 + (now.getMonth() + 1);

  return usage.budgets.filter(
    (budget) => budget.year * 12 + budget.month >= current,
  ).length;
}

export function canCreateTemplate(templateCount: number): boolean {
  return templateCount < MAX_TEMPLATES;
}
