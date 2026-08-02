import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '@modules/budget/domain/ports/budget-recalculation.port';
import {
  DEMO_REPOSITORY,
  type DemoRepositoryPort,
} from '../domain/ports/demo-repository.port';
import type {
  DemoSeededBudget,
  DemoSeededBudgetLine,
  DemoSeededTemplate,
  DemoSeededTemplateLine,
} from '../domain/demo.entity';
import { DEMO_SAVINGS_GOAL_SPECS } from '../domain/demo.constants';
import {
  buildBudgetLineSeeds,
  buildBudgetSeeds,
  buildSavingsGoalSeeds,
  buildTemplateSeeds,
} from '../domain/demo-seed.builders';
import { buildTransactionSeeds } from '../domain/demo-transaction-seeds';

@Injectable()
export class GenerateDemoDataUseCase {
  constructor(
    @Inject(DEMO_REPOSITORY) private readonly repo: DemoRepositoryPort,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    @InjectInfoLogger(GenerateDemoDataUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  /**
   * The clock is read once, here: the budget window, the pointage boundary, the
   * lissage window and the goal horizons must all agree on which month is the
   * current one, and a seed straddling midnight would otherwise disagree with
   * itself.
   */
  async execute(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    this.logger.info({ userId }, 'Starting demo data generation');
    const currentDate = new Date();

    const templates = await this.seedTemplates(userId, supabase);
    const templateLines = await this.seedTemplateLines(
      userId,
      templates,
      supabase,
    );
    const budgets = await this.seedBudgets(
      userId,
      templates,
      currentDate,
      supabase,
    );
    const budgetLines = await this.seedBudgetLines(
      userId,
      budgets,
      templateLines,
      currentDate,
      supabase,
    );
    await this.seedTransactions(
      userId,
      budgets,
      budgetLines,
      currentDate,
      supabase,
    );
    await this.seedSavingsGoals(userId, budgetLines, currentDate, supabase);

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
      buildTemplateSeeds(userId),
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
    currentDate: Date,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<DemoSeededBudget[]> {
    const budgets = await this.repo.insertBudgets(
      buildBudgetSeeds(userId, templates, currentDate),
      supabase,
    );
    this.logger.info({ userId, count: budgets.length }, 'Budgets created');
    return budgets;
  }

  private async seedBudgetLines(
    userId: string,
    budgets: DemoSeededBudget[],
    templateLines: DemoSeededTemplateLine[],
    currentDate: Date,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<DemoSeededBudgetLine[]> {
    const budgetLineSeeds = buildBudgetLineSeeds(
      budgets,
      templateLines,
      currentDate,
    );
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
    currentDate: Date,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const transactionSeeds = buildTransactionSeeds(
      budgets,
      budgetLines,
      currentDate,
    );
    await this.repo.insertTransactions(transactionSeeds, userId, supabase);
    this.logger.info(
      { userId, count: transactionSeeds.length },
      'Transactions created',
    );
  }

  private async seedSavingsGoals(
    userId: string,
    budgetLines: DemoSeededBudgetLine[],
    currentDate: Date,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const goals = await this.repo.insertSavingsGoals(
      buildSavingsGoalSeeds(userId, currentDate),
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
