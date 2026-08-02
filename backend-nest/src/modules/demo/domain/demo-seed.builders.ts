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
  DEMO_TEMPLATE_SPECS,
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

/** The instant a closed month is settled at, stamped on its pointage. */
export function lastInstantOfMonth(budget: {
  month: number;
  year: number;
}): string {
  const lastDay = new Date(budget.year, budget.month, 0).getDate();
  return new Date(budget.year, budget.month - 1, lastDay).toISOString();
}

export function buildTemplateSeeds(userId: string): DemoTemplateSeed[] {
  return [
    {
      userId,
      name: DEMO_TEMPLATE_SPECS.STANDARD.name,
      description: DEMO_TEMPLATE_SPECS.STANDARD.description,
      isDefault: DEMO_TEMPLATE_SPECS.STANDARD.isDefault,
    },
    {
      userId,
      name: DEMO_TEMPLATE_SPECS.VACATIONS.name,
      description: DEMO_TEMPLATE_SPECS.VACATIONS.description,
      isDefault: DEMO_TEMPLATE_SPECS.VACATIONS.isDefault,
    },
    {
      userId,
      name: DEMO_TEMPLATE_SPECS.SAVINGS.name,
      description: DEMO_TEMPLATE_SPECS.SAVINGS.description,
      isDefault: DEMO_TEMPLATE_SPECS.SAVINGS.isDefault,
    },
    {
      userId,
      name: DEMO_TEMPLATE_SPECS.HOLIDAYS.name,
      description: DEMO_TEMPLATE_SPECS.HOLIDAYS.description,
      isDefault: DEMO_TEMPLATE_SPECS.HOLIDAYS.isDefault,
    },
  ];
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

function selectTemplateForMonth(
  month: number,
  templates: DemoSeededTemplate[],
): { templateId: string; description: string } {
  if (month === 12) {
    return {
      templateId: templates[3].id,
      description: "Budget des fêtes de fin d'année 🎄",
    };
  }
  if (month === 7 || month === 8) {
    return {
      templateId: templates[1].id,
      description: "Budget vacances d'été ☀️",
    };
  }
  if (month === 3 || month === 9) {
    return {
      templateId: templates[2].id,
      description: "Focus sur l'épargne ce mois-ci 💪",
    };
  }
  return {
    templateId: templates[0].id,
    description: 'Budget mensuel standard',
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
      ? lastInstantOfMonth(budget)
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
          ? lastInstantOfMonth(budget)
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
