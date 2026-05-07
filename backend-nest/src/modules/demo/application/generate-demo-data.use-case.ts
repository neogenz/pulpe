import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { addMonths, startOfMonth } from 'date-fns';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '@modules/budget/domain/ports/budget-recalculation.port';
import { DEMO_CLIENT_KEY_BUFFER } from '@modules/encryption/encryption.service';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import {
  DEMO_REPOSITORY,
  type DemoRepositoryPort,
  type TemplateRow,
  type BudgetRow,
  type TemplateInsert,
  type MonthlyBudgetInsert,
  type BudgetLineInsert,
  type TransactionInsert,
} from '../domain/ports/demo-repository.port';
import { DEMO_TEMPLATE_SPECS } from '../domain/demo.constants';
import {
  getStandardMonthLines,
  getVacationMonthLines,
  getSavingsMonthLines,
  getHolidayMonthLines,
} from '../infrastructure/persistence/demo-template-specs';
import type { Tables } from '../../../types/database.types';

type TemplateLineRow = Tables<'template_line'>;

@Injectable()
export class GenerateDemoDataUseCase {
  constructor(
    @Inject(DEMO_REPOSITORY) private readonly repo: DemoRepositoryPort,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
    @InjectInfoLogger(GenerateDemoDataUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    this.logger.info({ userId }, 'Starting demo data generation');

    const dek = await this.encryption.ensureUserDEK(
      userId,
      DEMO_CLIENT_KEY_BUFFER,
    );

    const templates = await this.repo.insertTemplates(
      this.buildTemplateInserts(userId),
      supabase,
    );
    this.logger.info({ userId, count: templates.length }, 'Templates created');

    const templateLines = await this.repo.insertTemplateLines(
      this.buildTemplateLineInserts(templates, dek),
      supabase,
    );
    this.logger.info(
      { userId, count: templateLines.length },
      'Template lines created',
    );

    const budgets = await this.repo.insertBudgets(
      this.buildBudgetInserts(userId, templates),
      supabase,
    );
    this.logger.info({ userId, count: budgets.length }, 'Budgets created');

    const budgetLines = this.buildBudgetLineInserts(
      budgets,
      templateLines,
      dek,
    );
    await this.repo.insertBudgetLines(budgetLines, supabase);
    this.logger.info(
      { userId, count: budgetLines.length },
      'Budget lines created',
    );

    const transactions = this.buildTransactionInserts(budgets, dek);
    await this.repo.insertTransactions(transactions, supabase);
    this.logger.info(
      { userId, count: transactions.length },
      'Transactions created',
    );

    await this.recalculateAllBudgetBalances(budgets, supabase);
    this.logger.info(
      { userId, count: budgets.length },
      'Budget balances recalculated',
    );

    this.logger.info({ userId }, 'Demo data generation completed');
  }

  private buildTemplateInserts(userId: string): TemplateInsert[] {
    return [
      {
        user_id: userId,
        name: DEMO_TEMPLATE_SPECS.STANDARD.name,
        description: DEMO_TEMPLATE_SPECS.STANDARD.description,
        is_default: DEMO_TEMPLATE_SPECS.STANDARD.isDefault,
      },
      {
        user_id: userId,
        name: DEMO_TEMPLATE_SPECS.VACATIONS.name,
        description: DEMO_TEMPLATE_SPECS.VACATIONS.description,
        is_default: DEMO_TEMPLATE_SPECS.VACATIONS.isDefault,
      },
      {
        user_id: userId,
        name: DEMO_TEMPLATE_SPECS.SAVINGS.name,
        description: DEMO_TEMPLATE_SPECS.SAVINGS.description,
        is_default: DEMO_TEMPLATE_SPECS.SAVINGS.isDefault,
      },
      {
        user_id: userId,
        name: DEMO_TEMPLATE_SPECS.HOLIDAYS.name,
        description: DEMO_TEMPLATE_SPECS.HOLIDAYS.description,
        is_default: DEMO_TEMPLATE_SPECS.HOLIDAYS.isDefault,
      },
    ];
  }

  private buildTemplateLineInserts(
    templates: TemplateRow[],
    dek: Buffer,
  ): Omit<TemplateLineRow, 'id' | 'created_at' | 'updated_at'>[] {
    const [standard, vacations, savings, holidays] = templates;
    return [
      ...getStandardMonthLines(standard.id, this.encryption, dek),
      ...getVacationMonthLines(vacations.id, this.encryption, dek),
      ...getSavingsMonthLines(savings.id, this.encryption, dek),
      ...getHolidayMonthLines(holidays.id, this.encryption, dek),
    ];
  }

  private buildBudgetInserts(
    userId: string,
    templates: TemplateRow[],
  ): MonthlyBudgetInsert[] {
    const currentDate = new Date();
    const budgets: MonthlyBudgetInsert[] = [];

    for (let i = -6; i <= 5; i++) {
      const budgetDate = addMonths(startOfMonth(currentDate), i);
      const month = budgetDate.getMonth() + 1;
      const year = budgetDate.getFullYear();
      const { template, description } = this.selectTemplateForMonth(
        month,
        templates,
      );
      budgets.push({
        user_id: userId,
        month,
        year,
        description,
        template_id: template.id,
        ending_balance: null,
      });
    }

    return budgets;
  }

  private selectTemplateForMonth(
    month: number,
    templates: TemplateRow[],
  ): { template: TemplateRow; description: string } {
    if (month === 12) {
      return {
        template: templates[3],
        description: "Budget des fêtes de fin d'année 🎄",
      };
    }
    if (month === 7 || month === 8) {
      return {
        template: templates[1],
        description: "Budget vacances d'été ☀️",
      };
    }
    if (month === 3 || month === 9) {
      return {
        template: templates[2],
        description: "Focus sur l'épargne ce mois-ci 💪",
      };
    }
    return {
      template: templates[0],
      description: 'Budget mensuel standard',
    };
  }

  private buildBudgetLineInserts(
    budgets: BudgetRow[],
    templateLines: TemplateLineRow[],
    dek: Buffer,
  ): BudgetLineInsert[] {
    const lines: BudgetLineInsert[] = [];

    for (const budget of budgets) {
      const relevantLines = templateLines.filter(
        (tl) => tl.template_id === budget.template_id,
      );

      for (const templateLine of relevantLines) {
        const actualAmount = templateLine.amount
          ? this.encryption.decryptAmount(templateLine.amount, dek)
          : 0;

        lines.push({
          budget_id: budget.id,
          template_line_id: templateLine.id,
          savings_goal_id: null,
          name: templateLine.name,
          amount: this.encryption.encryptAmount(actualAmount, dek),
          kind: templateLine.kind,
          recurrence: templateLine.recurrence,
          is_manually_adjusted: false,
          checked_at: null,
          original_amount: null,
          original_currency: null,
          target_currency: null,
          exchange_rate: null,
        });
      }
    }

    return lines;
  }

  private buildTransactionInserts(
    budgets: BudgetRow[],
    dek: Buffer,
  ): TransactionInsert[] {
    const currentDate = new Date();
    const pastBudgets = budgets.filter((b) => {
      const budgetDate = new Date(b.year, b.month - 1);
      return budgetDate <= currentDate;
    });

    const transactions: TransactionInsert[] = [];

    for (const budget of pastBudgets) {
      const isCurrentMonth =
        budget.month === currentDate.getMonth() + 1 &&
        budget.year === currentDate.getFullYear();
      const daysInMonth = new Date(budget.year, budget.month, 0).getDate();
      const maxDay = isCurrentMonth ? currentDate.getDate() : daysInMonth;

      transactions.push(...this.buildMonthTransactions(budget, maxDay, dek));
    }

    return transactions;
  }

  private buildMonthTransactions(
    budget: BudgetRow,
    maxDay: number,
    dek: Buffer,
  ): TransactionInsert[] {
    const transactions: TransactionInsert[] = [];

    if (maxDay >= 5) {
      transactions.push(
        this.buildTransaction(
          budget,
          5,
          'Migros - Courses',
          127.85,
          'Alimentation',
          dek,
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
          dek,
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
          dek,
        ),
      );
    }

    return transactions;
  }

  private buildTransaction(
    budget: BudgetRow,
    day: number,
    name: string,
    amount: number,
    category: string,
    dek: Buffer,
  ): TransactionInsert {
    return {
      budget_id: budget.id,
      budget_line_id: null,
      name,
      amount: this.encryption.encryptAmount(amount, dek),
      kind: 'expense',
      category,
      transaction_date: new Date(
        budget.year,
        budget.month - 1,
        day,
      ).toISOString(),
      checked_at: null,
      original_amount: null,
      original_currency: null,
      target_currency: null,
      exchange_rate: null,
    };
  }

  private async recalculateAllBudgetBalances(
    budgets: BudgetRow[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const sorted = [...budgets].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    for (const budget of sorted) {
      await this.budgetRecalculation.recalculate(
        budget.id,
        supabase,
        DEMO_CLIENT_KEY_BUFFER,
      );
    }
  }
}
