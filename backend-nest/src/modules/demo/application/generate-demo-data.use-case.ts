import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { addMonths, format, startOfMonth } from 'date-fns';
import { splitTotalPreserving } from 'pulpe-shared';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '@modules/budget/domain/ports/budget-recalculation.port';
import {
  DEMO_REPOSITORY,
  type DemoRepositoryPort,
} from '../domain/ports/demo-repository.port';
import type {
  DemoBudgetLineSeed,
  DemoBudgetSeed,
  DemoSavingsGoalSeed,
  DemoSeededBudget,
  DemoSeededBudgetLine,
  DemoSeededTemplate,
  DemoSeededTemplateLine,
  DemoTemplateSeed,
  DemoTransactionSeed,
} from '../domain/demo.entity';
import {
  DEMO_SAVINGS_GOAL_SPECS,
  DEMO_SPREAD_SPEC,
  DEMO_TEMPLATE_SPECS,
} from '../domain/demo.constants';

/** The demo spans six closed months before the current one. */
const FIRST_SEEDED_MONTH_OFFSET = -6;
const DATE_COLUMN_FORMAT = 'yyyy-MM-dd';

/**
 * The month's actuals. `envelopeName` names the prévision each one consumes —
 * a budget built from another template may not carry it, and the actual then
 * stays unattached, which is a legitimate state to show.
 */
const MONTH_TRANSACTION_SPECS = [
  {
    day: 5,
    name: 'Migros - Courses',
    amount: 127.85,
    tagName: 'Alimentation',
    envelopeName: 'Courses alimentaires',
  },
  {
    day: 10,
    name: 'Restaurant Molino',
    amount: 78.5,
    tagName: 'Restaurants',
    envelopeName: 'Restaurants/Sorties',
  },
  {
    day: 15,
    name: 'Coop - Courses',
    amount: 94.2,
    tagName: 'Alimentation',
    envelopeName: 'Courses alimentaires',
  },
] as const;

@Injectable()
export class GenerateDemoDataUseCase {
  constructor(
    @Inject(DEMO_REPOSITORY) private readonly repo: DemoRepositoryPort,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    @InjectInfoLogger(GenerateDemoDataUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    this.logger.info({ userId }, 'Starting demo data generation');

    const templates = await this.seedTemplates(userId, supabase);
    const templateLines = await this.seedTemplateLines(
      userId,
      templates,
      supabase,
    );
    const budgets = await this.seedBudgets(userId, templates, supabase);
    const budgetLines = await this.seedBudgetLines(
      userId,
      budgets,
      templateLines,
      supabase,
    );
    await this.seedTransactions(userId, budgets, budgetLines, supabase);
    await this.seedSavingsGoals(userId, budgetLines, supabase);

    await this.recalculateAllBudgetBalances(budgets);
    this.logger.info(
      { userId, count: budgets.length },
      'Budget balances recalculated',
    );

    this.logger.info({ userId }, 'Demo data generation completed');
  }

  private async seedTemplates(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<DemoSeededTemplate[]> {
    const templates = await this.repo.insertTemplates(
      this.buildTemplateSeeds(userId),
      supabase,
    );
    this.logger.info({ userId, count: templates.length }, 'Templates created');
    return templates;
  }

  private async seedTemplateLines(
    userId: string,
    templates: DemoSeededTemplate[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<DemoSeededTemplateLine[]> {
    const [standard, vacations, savings, holidays] = templates;
    const templateLines = await this.repo.insertCanonicalTemplateLines(
      {
        standardId: standard.id,
        vacationId: vacations.id,
        savingsId: savings.id,
        holidayId: holidays.id,
      },
      userId,
      supabase,
    );
    this.logger.info(
      { userId, count: templateLines.length },
      'Template lines created',
    );
    return templateLines;
  }

  private async seedBudgets(
    userId: string,
    templates: DemoSeededTemplate[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<DemoSeededBudget[]> {
    const budgets = await this.repo.insertBudgets(
      this.buildBudgetSeeds(userId, templates),
      supabase,
    );
    this.logger.info({ userId, count: budgets.length }, 'Budgets created');
    return budgets;
  }

  private async seedBudgetLines(
    userId: string,
    budgets: DemoSeededBudget[],
    templateLines: DemoSeededTemplateLine[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<DemoSeededBudgetLine[]> {
    const budgetLineSeeds = this.buildBudgetLineSeeds(budgets, templateLines);
    const seededLines = await this.repo.insertBudgetLines(
      budgetLineSeeds,
      userId,
      supabase,
    );
    this.logger.info(
      { userId, count: budgetLineSeeds.length },
      'Budget lines created',
    );
    return seededLines;
  }

  private async seedTransactions(
    userId: string,
    budgets: DemoSeededBudget[],
    budgetLines: DemoSeededBudgetLine[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const transactionSeeds = this.buildTransactionSeeds(budgets, budgetLines);
    await this.repo.insertTransactions(transactionSeeds, userId, supabase);
    this.logger.info(
      { userId, count: transactionSeeds.length },
      'Transactions created',
    );
  }

  private async seedSavingsGoals(
    userId: string,
    budgetLines: DemoSeededBudgetLine[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const goals = await this.repo.insertSavingsGoals(
      this.buildSavingsGoalSeeds(userId, new Date()),
      userId,
      supabase,
    );
    this.logger.info({ userId, count: goals.length }, 'Savings goals created');

    for (const goal of goals) {
      const spec = DEMO_SAVINGS_GOAL_SPECS.find((s) => s.name === goal.name);
      if (!spec?.envelopeName) continue;

      const envelopeIds = budgetLines
        .filter(
          (line) => line.kind === 'saving' && line.name === spec.envelopeName,
        )
        .map((line) => line.id);
      await this.repo.linkBudgetLinesToSavingsGoal(
        envelopeIds,
        goal.id,
        supabase,
      );
    }
  }

  private buildSavingsGoalSeeds(
    userId: string,
    currentDate: Date,
  ): DemoSavingsGoalSeed[] {
    const firstSeededMonth = addMonths(
      startOfMonth(currentDate),
      FIRST_SEEDED_MONTH_OFFSET,
    );

    return DEMO_SAVINGS_GOAL_SPECS.map((spec) => {
      const horizon = this.goalHorizon(spec.monthsUntilTarget, currentDate);

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
  private goalHorizon(
    monthsUntilTarget: number | null,
    currentDate: Date,
  ): Date | null {
    if (monthsUntilTarget === null) return null;
    return addMonths(startOfMonth(currentDate), monthsUntilTarget);
  }

  private buildTemplateSeeds(userId: string): DemoTemplateSeed[] {
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

  private buildBudgetSeeds(
    userId: string,
    templates: DemoSeededTemplate[],
  ): DemoBudgetSeed[] {
    const currentDate = new Date();
    const budgets: DemoBudgetSeed[] = [];

    for (let i = FIRST_SEEDED_MONTH_OFFSET; i <= 5; i++) {
      const budgetDate = addMonths(startOfMonth(currentDate), i);
      const month = budgetDate.getMonth() + 1;
      const year = budgetDate.getFullYear();
      const { templateId, description } = this.selectTemplateForMonth(
        month,
        templates,
      );
      budgets.push({ userId, month, year, description, templateId });
    }

    return budgets;
  }

  private selectTemplateForMonth(
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

  private buildBudgetLineSeeds(
    budgets: DemoSeededBudget[],
    templateLines: DemoSeededTemplateLine[],
  ): DemoBudgetLineSeed[] {
    const currentDate = new Date();
    const lines: DemoBudgetLineSeed[] = [];

    for (const budget of budgets) {
      const relevantLines = templateLines.filter(
        (tl) => tl.templateId === budget.templateId,
      );
      const checkedAt = this.isClosedMonth(budget, currentDate)
        ? this.endOfMonth(budget)
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

    return [...lines, ...this.buildSpreadTrancheSeeds(budgets, currentDate)];
  }

  /**
   * The tranches of the demo's lissage: sibling one_off lines sharing one group
   * id, never issued from the Mois Type, whose amounts sum back to the total.
   */
  private buildSpreadTrancheSeeds(
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
          checkedAt: this.isClosedMonth(budget, currentDate)
            ? this.endOfMonth(budget)
            : null,
          spreadGroupId,
        },
      ];
    });
  }

  /** A month strictly before the current one is closed: its ledger is settled. */
  private isClosedMonth(
    budget: { month: number; year: number },
    currentDate: Date,
  ): boolean {
    if (budget.year !== currentDate.getFullYear()) {
      return budget.year < currentDate.getFullYear();
    }
    return budget.month < currentDate.getMonth() + 1;
  }

  private endOfMonth(budget: { month: number; year: number }): string {
    const lastDay = new Date(budget.year, budget.month, 0).getDate();
    return new Date(budget.year, budget.month - 1, lastDay).toISOString();
  }

  private buildTransactionSeeds(
    budgets: DemoSeededBudget[],
    budgetLines: DemoSeededBudgetLine[],
  ): DemoTransactionSeed[] {
    const currentDate = new Date();
    const pastBudgets = budgets.filter((b) => {
      const budgetDate = new Date(b.year, b.month - 1);
      return budgetDate <= currentDate;
    });

    const envelopesByBudget = new Map<string, DemoSeededBudgetLine[]>();
    for (const line of budgetLines) {
      const existing = envelopesByBudget.get(line.budgetId);
      if (existing) existing.push(line);
      else envelopesByBudget.set(line.budgetId, [line]);
    }

    const transactions: DemoTransactionSeed[] = [];

    for (const budget of pastBudgets) {
      const isCurrentMonth =
        budget.month === currentDate.getMonth() + 1 &&
        budget.year === currentDate.getFullYear();
      const daysInMonth = new Date(budget.year, budget.month, 0).getDate();
      const maxDay = isCurrentMonth ? currentDate.getDate() : daysInMonth;

      transactions.push(
        ...this.buildMonthTransactions(
          budget,
          maxDay,
          envelopesByBudget.get(budget.id) ?? [],
          currentDate,
        ),
      );
    }

    return transactions;
  }

  private buildMonthTransactions(
    budget: DemoSeededBudget,
    maxDay: number,
    envelopes: DemoSeededBudgetLine[],
    currentDate: Date,
  ): DemoTransactionSeed[] {
    const isClosed = this.isClosedMonth(budget, currentDate);

    return MONTH_TRANSACTION_SPECS.filter((spec) => maxDay >= spec.day).map(
      (spec) => {
        const transactionDate = new Date(
          budget.year,
          budget.month - 1,
          spec.day,
        ).toISOString();

        return {
          budgetId: budget.id,
          budgetLineId:
            envelopes.find((line) => line.name === spec.envelopeName)?.id ??
            null,
          name: spec.name,
          amount: spec.amount,
          kind: 'expense',
          tagName: spec.tagName,
          transactionDate,
          checkedAt: isClosed ? transactionDate : null,
        };
      },
    );
  }

  private async recalculateAllBudgetBalances(
    budgets: DemoSeededBudget[],
  ): Promise<void> {
    const sorted = [...budgets].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    for (const budget of sorted) {
      await this.budgetRecalculation.recalculate(budget.id);
    }
  }
}
