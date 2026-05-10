import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { addMonths, startOfMonth } from 'date-fns';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '@modules/budget/domain/ports/budget-recalculation.port';
import { DEMO_CLIENT_KEY_BUFFER } from '@modules/encryption/domain/encryption.constants';
import {
  DEMO_REPOSITORY,
  type DemoRepositoryPort,
} from '../domain/ports/demo-repository.port';
import type {
  DemoBudgetLineSeed,
  DemoBudgetSeed,
  DemoSeededBudget,
  DemoSeededTemplate,
  DemoSeededTemplateLine,
  DemoTemplateSeed,
  DemoTransactionSeed,
} from '../domain/demo.entity';
import { DEMO_TEMPLATE_SPECS } from '../domain/demo.constants';

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
    await this.seedBudgetLines(userId, budgets, templateLines, supabase);
    await this.seedTransactions(userId, budgets, supabase);

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
  ): Promise<void> {
    const budgetLineSeeds = this.buildBudgetLineSeeds(budgets, templateLines);
    await this.repo.insertBudgetLines(budgetLineSeeds, userId, supabase);
    this.logger.info(
      { userId, count: budgetLineSeeds.length },
      'Budget lines created',
    );
  }

  private async seedTransactions(
    userId: string,
    budgets: DemoSeededBudget[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const transactionSeeds = this.buildTransactionSeeds(budgets);
    await this.repo.insertTransactions(transactionSeeds, userId, supabase);
    this.logger.info(
      { userId, count: transactionSeeds.length },
      'Transactions created',
    );
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

    for (let i = -6; i <= 5; i++) {
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
    const lines: DemoBudgetLineSeed[] = [];

    for (const budget of budgets) {
      const relevantLines = templateLines.filter(
        (tl) => tl.templateId === budget.templateId,
      );

      for (const templateLine of relevantLines) {
        lines.push({
          budgetId: budget.id,
          templateLineId: templateLine.id,
          name: templateLine.name,
          amount: templateLine.amount,
          kind: templateLine.kind,
          recurrence: templateLine.recurrence,
        });
      }
    }

    return lines;
  }

  private buildTransactionSeeds(
    budgets: DemoSeededBudget[],
  ): DemoTransactionSeed[] {
    const currentDate = new Date();
    const pastBudgets = budgets.filter((b) => {
      const budgetDate = new Date(b.year, b.month - 1);
      return budgetDate <= currentDate;
    });

    const transactions: DemoTransactionSeed[] = [];

    for (const budget of pastBudgets) {
      const isCurrentMonth =
        budget.month === currentDate.getMonth() + 1 &&
        budget.year === currentDate.getFullYear();
      const daysInMonth = new Date(budget.year, budget.month, 0).getDate();
      const maxDay = isCurrentMonth ? currentDate.getDate() : daysInMonth;

      transactions.push(...this.buildMonthTransactions(budget, maxDay));
    }

    return transactions;
  }

  private buildMonthTransactions(
    budget: DemoSeededBudget,
    maxDay: number,
  ): DemoTransactionSeed[] {
    const transactions: DemoTransactionSeed[] = [];

    if (maxDay >= 5) {
      transactions.push(
        this.buildTransaction(
          budget,
          5,
          'Migros - Courses',
          127.85,
          'Alimentation',
        ),
      );
    }
    if (maxDay >= 10) {
      transactions.push(
        this.buildTransaction(
          budget,
          10,
          'Restaurant Molino',
          78.5,
          'Restaurants',
        ),
      );
    }
    if (maxDay >= 15) {
      transactions.push(
        this.buildTransaction(
          budget,
          15,
          'Coop - Courses',
          94.2,
          'Alimentation',
        ),
      );
    }

    return transactions;
  }

  private buildTransaction(
    budget: DemoSeededBudget,
    day: number,
    name: string,
    amount: number,
    category: string,
  ): DemoTransactionSeed {
    return {
      budgetId: budget.id,
      name,
      amount,
      kind: 'expense',
      category,
      transactionDate: new Date(
        budget.year,
        budget.month - 1,
        day,
      ).toISOString(),
    };
  }

  private async recalculateAllBudgetBalances(
    budgets: DemoSeededBudget[],
  ): Promise<void> {
    const sorted = [...budgets].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    for (const budget of sorted) {
      await this.budgetRecalculation.recalculate(
        budget.id,
        DEMO_CLIENT_KEY_BUFFER,
      );
    }
  }
}
