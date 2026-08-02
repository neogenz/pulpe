import { randomUUID } from 'node:crypto';
import { addMonths, format, startOfMonth } from 'date-fns';
import { splitTotalPreserving } from 'pulpe-shared';
import type {
  DemoBudgetLineSeed,
  DemoBudgetSeed,
  DemoSavingsGoalSeed,
  DemoSeededBudget,
  DemoSeededTemplate,
  DemoSeededTemplateLine,
  DemoTemplateSeed,
} from './demo.entity';
import {
  DEMO_SAVINGS_GOAL_SPECS,
  DEMO_SPREAD_SPEC,
  DEMO_TEMPLATE_ORDER,
  DEMO_TEMPLATE_SPECS,
  type DemoTemplateKey,
} from './demo.constants';

/** The demo spans six closed months before the current one. */
export const FIRST_SEEDED_MONTH_OFFSET = -6;
const LAST_SEEDED_MONTH_OFFSET = 5;
export const DATE_COLUMN_FORMAT = 'yyyy-MM-dd';

/** A month strictly before the current one is closed: its ledger is settled. */
export function isClosedMonth(
  budget: { month: number; year: number },
  currentDate: Date,
): boolean {
  if (budget.year !== currentDate.getFullYear()) {
    return budget.year < currentDate.getFullYear();
  }
  return budget.month < currentDate.getMonth() + 1;
}

/**
 * The instant a closed month is settled at, stamped on its pointage: midnight
 * on the month's last day, not the last instant of it. Anything later would
 * render as the next month's first day for a reader east of UTC.
 */
export function settlementStampForMonth(budget: {
  month: number;
  year: number;
}): string {
  const lastDay = new Date(budget.year, budget.month, 0).getDate();
  return new Date(budget.year, budget.month - 1, lastDay).toISOString();
}

export function buildTemplateSeeds(userId: string): DemoTemplateSeed[] {
  return DEMO_TEMPLATE_ORDER.map((key) => ({
    userId,
    name: DEMO_TEMPLATE_SPECS[key].name,
    description: DEMO_TEMPLATE_SPECS[key].description,
    isDefault: DEMO_TEMPLATE_SPECS[key].isDefault,
  }));
}

export function buildBudgetSeeds(
  userId: string,
  templates: DemoSeededTemplate[],
  currentDate: Date,
): DemoBudgetSeed[] {
  const budgets: DemoBudgetSeed[] = [];

  for (
    let offset = FIRST_SEEDED_MONTH_OFFSET;
    offset <= LAST_SEEDED_MONTH_OFFSET;
    offset++
  ) {
    const budgetDate = addMonths(startOfMonth(currentDate), offset);
    const month = budgetDate.getMonth() + 1;
    const year = budgetDate.getFullYear();
    const { templateId, description } = selectTemplateForMonth(
      month,
      templates,
    );
    budgets.push({ userId, month, year, description, templateId });
  }

  return budgets;
}

/**
 * Which template a month runs on. The themed months are fixed by the calendar,
 * so anything else keyed on the month — the actuals it can consume, above all —
 * asks this rather than re-deriving the same calendar.
 */
export function templateKeyForMonth(month: number): DemoTemplateKey {
  if (month === 12) return 'HOLIDAYS';
  if (month === 7 || month === 8) return 'VACATIONS';
  if (month === 3 || month === 9) return 'SAVINGS';
  return 'STANDARD';
}

const MONTH_DESCRIPTIONS: Record<DemoTemplateKey, string> = {
  STANDARD: 'Budget mensuel standard',
  VACATIONS: "Budget vacances d'été ☀️",
  SAVINGS: "Focus sur l'épargne ce mois-ci 💪",
  HOLIDAYS: "Budget des fêtes de fin d'année 🎄",
};

function selectTemplateForMonth(
  month: number,
  templates: DemoSeededTemplate[],
): { templateId: string; description: string } {
  const key = templateKeyForMonth(month);
  return {
    templateId: templates[DEMO_TEMPLATE_ORDER.indexOf(key)].id,
    description: MONTH_DESCRIPTIONS[key],
  };
}

export function buildBudgetLineSeeds(
  budgets: DemoSeededBudget[],
  templateLines: DemoSeededTemplateLine[],
  currentDate: Date,
): DemoBudgetLineSeed[] {
  const lines: DemoBudgetLineSeed[] = [];

  for (const budget of budgets) {
    const relevantLines = templateLines.filter(
      (tl) => tl.templateId === budget.templateId,
    );
    const checkedAt = isClosedMonth(budget, currentDate)
      ? settlementStampForMonth(budget)
      : null;

    for (const templateLine of relevantLines) {
      lines.push({
        budgetId: budget.id,
        templateLineId: templateLine.id,
        name: templateLine.name,
        amount: templateLine.amount,
        kind: templateLine.kind,
        recurrence: templateLine.recurrence,
        checkedAt,
        spreadGroupId: null,
      });
    }
  }

  return [...lines, ...buildSpreadTrancheSeeds(budgets, currentDate)];
}

/**
 * The tranches of the demo's lissage: sibling one_off lines sharing one group
 * id, never issued from the Mois Type, whose amounts sum back to the total.
 */
function buildSpreadTrancheSeeds(
  budgets: DemoSeededBudget[],
  currentDate: Date,
): DemoBudgetLineSeed[] {
  const spreadGroupId = randomUUID();
  const budgetsByPeriod = new Map(
    budgets.map((budget) => [`${budget.year}-${budget.month}`, budget]),
  );

  return splitTotalPreserving(
    DEMO_SPREAD_SPEC.totalAmount,
    DEMO_SPREAD_SPEC.monthCount,
  ).flatMap((amount, index) => {
    const monthDate = addMonths(
      startOfMonth(currentDate),
      DEMO_SPREAD_SPEC.firstMonthOffset + index,
    );
    const budget = budgetsByPeriod.get(
      `${monthDate.getFullYear()}-${monthDate.getMonth() + 1}`,
    );
    if (!budget) return [];

    return [
      {
        budgetId: budget.id,
        templateLineId: null,
        name: DEMO_SPREAD_SPEC.name,
        amount,
        kind: 'expense' as const,
        recurrence: 'one_off' as const,
        checkedAt: isClosedMonth(budget, currentDate)
          ? settlementStampForMonth(budget)
          : null,
        spreadGroupId,
      },
    ];
  });
}

export function buildSavingsGoalSeeds(
  userId: string,
  currentDate: Date,
): DemoSavingsGoalSeed[] {
  const firstSeededMonth = addMonths(
    startOfMonth(currentDate),
    FIRST_SEEDED_MONTH_OFFSET,
  );

  return DEMO_SAVINGS_GOAL_SPECS.map((spec) => {
    const horizon = goalHorizon(spec.monthsUntilTarget, currentDate);

    return {
      userId,
      name: spec.name,
      targetAmount: spec.targetAmount,
      initialAmount: spec.initialAmount,
      status: spec.status,
      startDate: format(firstSeededMonth, DATE_COLUMN_FORMAT),
      targetDate: horizon ? format(horizon, DATE_COLUMN_FORMAT) : null,
    };
  });
}

/** A null `monthsUntilTarget` means an open-ended plan: no deadline. */
function goalHorizon(
  monthsUntilTarget: number | null,
  currentDate: Date,
): Date | null {
  if (monthsUntilTarget === null) return null;
  return addMonths(startOfMonth(currentDate), monthsUntilTarget);
}
