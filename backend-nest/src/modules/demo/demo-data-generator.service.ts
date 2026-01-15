import { Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedSupabaseClient } from '../supabase/supabase.service';
import { addMonths, startOfMonth } from 'date-fns';
import type { Tables } from '../../types/database.types';
import { BudgetCalculator } from '../budget/budget.calculator';

type TemplateRow = Tables<'template'>;
type TemplateLineRow = Tables<'template_line'>;
type BudgetRow = Tables<'monthly_budget'>;
type BudgetLineRow = Tables<'budget_line'>;
type TransactionRow = Tables<'transaction'>;

/**
 * Service responsible for generating realistic demo data for a new demo user
 *
 * Creates a complete financial scenario with:
 * - 4 budget templates (Standard, Vacations, Savings Focus, Holidays)
 * - 12 months of budgets (6 past + 6 future)
 * - Budget lines based on templates
 * - Sample transactions for demonstration
 */
@Injectable()
export class DemoDataGeneratorService {
  constructor(
    @InjectInfoLogger(DemoDataGeneratorService.name)
    private readonly logger: InfoLogger,
    private readonly budgetCalculator: BudgetCalculator,
  ) {}

  /**
   * Seeds complete demo data for a user
   * Uses the authenticated Supabase client so RLS policies apply naturally
   */
  async seedDemoData(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    this.logger.info({ userId }, 'Starting demo data generation');

    // 1. Create templates
    const templates = await this.createTemplates(userId, supabase);
    this.logger.info({ userId, count: templates.length }, 'Templates created');

    // 2. Create template lines
    const templateLines = await this.createTemplateLines(templates, supabase);
    this.logger.info(
      { userId, count: templateLines.length },
      'Template lines created',
    );

    // 3. Create budgets (6 past + 6 future months)
    const budgets = await this.createBudgets(userId, templates, supabase);
    this.logger.info({ userId, count: budgets.length }, 'Budgets created');

    // 4. Create budget lines
    const budgetLines = await this.createBudgetLines(
      budgets,
      templateLines,
      supabase,
    );
    this.logger.info(
      { userId, count: budgetLines.length },
      'Budget lines created',
    );

    // 5. Create sample transactions (for past months only)
    const transactions = await this.createTransactions(budgets, supabase);
    this.logger.info(
      { userId, count: transactions.length },
      'Transactions created',
    );

    // 6. Recalculate ending_balance for all budgets (enables rollover calculation)
    await this.recalculateAllBudgetBalances(budgets, supabase);
    this.logger.info(
      { userId, count: budgets.length },
      'Budget balances recalculated',
    );

    this.logger.info({ userId }, 'Demo data generation completed');
  }

  private async createTemplates(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateRow[]> {
    const { data, error } = await supabase
      .from('template')
      .insert([
        {
          user_id: userId,
          name: '💰 Mois Standard',
          description:
            'Mon budget mensuel habituel avec toutes mes dépenses récurrentes',
          is_default: true,
        },
        {
          user_id: userId,
          name: '✈️ Mois Vacances',
          description:
            'Budget spécial pour les mois avec voyages et sorties supplémentaires',
          is_default: false,
        },
        {
          user_id: userId,
          name: '🎯 Mois Économies Renforcées',
          description:
            "Focus sur l'épargne avec réduction des dépenses variables",
          is_default: false,
        },
        {
          user_id: userId,
          name: '🎄 Mois de Fêtes',
          description:
            'Budget adapté pour les périodes de fêtes avec cadeaux et repas',
          is_default: false,
        },
      ])
      .select();

    if (error) throw error;
    return data;
  }

  private async createTemplateLines(
    templates: TemplateRow[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineRow[]> {
    const [standard, vacations, savings, holidays] = templates;

    const allLines: Omit<
      TemplateLineRow,
      'id' | 'created_at' | 'updated_at'
    >[] = [
      // Template 1: Standard Month
      ...this.getStandardMonthLines(standard.id),
      // Template 2: Vacation Month
      ...this.getVacationMonthLines(vacations.id),
      // Template 3: Savings Focus Month
      ...this.getSavingsMonthLines(savings.id),
      // Template 4: Holiday Month
      ...this.getHolidayMonthLines(holidays.id),
    ];

    const { data, error } = await supabase
      .from('template_line')
      .insert(allLines)
      .select();

    if (error) throw error;
    return data;
  }

  private getStandardMonthLines(
    templateId: string,
  ): Omit<TemplateLineRow, 'id' | 'created_at' | 'updated_at'>[] {
    return [
      ...this.getStandardIncomeLines(templateId),
      ...this.getStandardFixedExpenses(templateId),
      ...this.getStandardVariableExpenses(templateId),
      ...this.getStandardSavings(templateId),
    ];
  }

  private getStandardIncomeLines(templateId: string) {
    return [
      this.createLine(templateId, 'Salaire net', 6500, 'income', 'fixed'),
      this.createLine(templateId, 'Freelance design', 800, 'income', 'one_off'),
    ];
  }

  private getStandardFixedExpenses(templateId: string) {
    return [
      this.createLine(templateId, 'Loyer', 1850, 'expense', 'fixed'),
      this.createLine(templateId, 'Charges', 180, 'expense', 'fixed'),
      this.createLine(templateId, 'Assurance maladie', 385, 'expense', 'fixed'),
      this.createLine(templateId, 'Abonnement mobile', 69, 'expense', 'fixed'),
      this.createLine(templateId, 'Internet & TV', 89, 'expense', 'fixed'),
      this.createLine(templateId, 'Abonnement CFF', 185, 'expense', 'fixed'),
      this.createLine(
        templateId,
        'Assurance RC/Ménage',
        35,
        'expense',
        'fixed',
      ),
      this.createLine(templateId, 'Netflix & Spotify', 38, 'expense', 'fixed'),
      this.createLine(templateId, 'Salle de sport', 99, 'expense', 'fixed'),
    ];
  }

  private getStandardVariableExpenses(templateId: string) {
    return [
      this.createLine(
        templateId,
        'Courses alimentaires',
        600,
        'expense',
        'one_off',
      ),
      this.createLine(
        templateId,
        'Restaurants/Sorties',
        400,
        'expense',
        'one_off',
      ),
      this.createLine(
        templateId,
        'Shopping vêtements',
        200,
        'expense',
        'one_off',
      ),
      this.createLine(templateId, 'Essence/Parking', 150, 'expense', 'one_off'),
      this.createLine(templateId, 'Pharmacie/Santé', 80, 'expense', 'one_off'),
      this.createLine(templateId, 'Coiffeur/Beauté', 120, 'expense', 'one_off'),
      this.createLine(templateId, 'Divers/Imprévus', 150, 'expense', 'one_off'),
    ];
  }

  private getStandardSavings(templateId: string) {
    return [
      this.createLine(templateId, 'Épargne logement', 1000, 'saving', 'fixed'),
      this.createLine(templateId, '3ème pilier', 580, 'saving', 'fixed'),
      this.createLine(templateId, "Fonds d'urgence", 300, 'saving', 'fixed'),
    ];
  }

  private createLine(
    templateId: string,
    name: string,
    amount: number,
    kind: 'income' | 'expense' | 'saving',
    recurrence: 'fixed' | 'one_off',
  ): Omit<TemplateLineRow, 'id' | 'created_at' | 'updated_at'> {
    return {
      template_id: templateId,
      name,
      amount,
      kind,
      recurrence,
      description: '',
    };
  }

  private getVacationMonthLines(
    templateId: string,
  ): Omit<TemplateLineRow, 'id' | 'created_at' | 'updated_at'>[] {
    return [
      ...this.getVacationIncomeLines(templateId),
      ...this.getVacationFixedExpenses(templateId),
      ...this.getVacationSpecificExpenses(templateId),
      ...this.getVacationSavings(templateId),
    ];
  }

  private getVacationIncomeLines(templateId: string) {
    return [
      this.createLine(templateId, 'Salaire net', 6500, 'income', 'fixed'),
      this.createLine(templateId, '13ème salaire', 2500, 'income', 'one_off'),
    ];
  }

  private getVacationFixedExpenses(templateId: string) {
    return [
      this.createLine(templateId, 'Loyer', 1850, 'expense', 'fixed'),
      this.createLine(templateId, 'Charges', 180, 'expense', 'fixed'),
      this.createLine(templateId, 'Assurance maladie', 385, 'expense', 'fixed'),
      this.createLine(
        templateId,
        'Abonnements divers',
        281,
        'expense',
        'fixed',
      ),
    ];
  }

  private getVacationSpecificExpenses(templateId: string) {
    return [
      this.createLine(templateId, "Billets d'avion", 800, 'expense', 'one_off'),
      this.createLine(
        templateId,
        'Hôtel (7 nuits)',
        1200,
        'expense',
        'one_off',
      ),
      this.createLine(
        templateId,
        'Budget vacances',
        1500,
        'expense',
        'one_off',
      ),
      this.createLine(templateId, 'Assurance voyage', 85, 'expense', 'one_off'),
    ];
  }

  private getVacationSavings(templateId: string) {
    return [this.createLine(templateId, '3ème pilier', 580, 'saving', 'fixed')];
  }

  private getSavingsMonthLines(
    templateId: string,
  ): Omit<TemplateLineRow, 'id' | 'created_at' | 'updated_at'>[] {
    return [
      ...this.getSavingsIncomeLines(templateId),
      ...this.getSavingsMinimalExpenses(templateId),
      ...this.getSavingsMaximized(templateId),
    ];
  }

  private getSavingsIncomeLines(templateId: string) {
    return [
      this.createLine(templateId, 'Salaire net', 6500, 'income', 'fixed'),
      this.createLine(templateId, 'Vente Anibis', 200, 'income', 'one_off'),
    ];
  }

  private getSavingsMinimalExpenses(templateId: string) {
    return [
      this.createLine(templateId, 'Loyer', 1850, 'expense', 'fixed'),
      this.createLine(templateId, 'Charges', 180, 'expense', 'fixed'),
      this.createLine(templateId, 'Assurance maladie', 385, 'expense', 'fixed'),
      this.createLine(
        templateId,
        'Abonnements essentiels',
        154,
        'expense',
        'fixed',
      ),
      this.createLine(
        templateId,
        'Courses (budget serré)',
        400,
        'expense',
        'one_off',
      ),
      this.createLine(templateId, 'Transport', 185, 'expense', 'fixed'),
      this.createLine(templateId, 'Minimum vital', 200, 'expense', 'one_off'),
    ];
  }

  private getSavingsMaximized(templateId: string) {
    return [
      this.createLine(templateId, 'Épargne logement', 1700, 'saving', 'fixed'),
      this.createLine(templateId, '3ème pilier', 580, 'saving', 'fixed'),
      this.createLine(templateId, 'Investissement ETF', 400, 'saving', 'fixed'),
      this.createLine(templateId, "Fonds d'urgence", 400, 'saving', 'fixed'),
    ];
  }

  private getHolidayMonthLines(
    templateId: string,
  ): Omit<TemplateLineRow, 'id' | 'created_at' | 'updated_at'>[] {
    return [
      ...this.getHolidayIncomeLines(templateId),
      ...this.getHolidayFixedExpenses(templateId),
      ...this.getHolidaySpecificExpenses(templateId),
      ...this.getHolidaySavings(templateId),
    ];
  }

  private getHolidayIncomeLines(templateId: string) {
    return [
      this.createLine(templateId, 'Salaire net', 6500, 'income', 'fixed'),
      this.createLine(
        templateId,
        "Prime de fin d'année",
        3000,
        'income',
        'one_off',
      ),
    ];
  }

  private getHolidayFixedExpenses(templateId: string) {
    return [
      this.createLine(templateId, 'Loyer', 1850, 'expense', 'fixed'),
      this.createLine(templateId, 'Charges', 180, 'expense', 'fixed'),
      this.createLine(
        templateId,
        'Assurances diverses',
        420,
        'expense',
        'fixed',
      ),
      this.createLine(templateId, 'Abonnements', 281, 'expense', 'fixed'),
    ];
  }

  private getHolidaySpecificExpenses(templateId: string) {
    return [
      this.createLine(templateId, 'Cadeaux famille', 800, 'expense', 'one_off'),
      this.createLine(templateId, 'Cadeaux amis', 400, 'expense', 'one_off'),
      this.createLine(templateId, 'Repas de fêtes', 600, 'expense', 'one_off'),
      this.createLine(templateId, 'Décorations', 150, 'expense', 'one_off'),
      this.createLine(
        templateId,
        'Sorties festives',
        500,
        'expense',
        'one_off',
      ),
      this.createLine(templateId, 'Tenue de soirée', 350, 'expense', 'one_off'),
    ];
  }

  private getHolidaySavings(templateId: string) {
    return [
      this.createLine(templateId, 'Épargne logement', 1000, 'saving', 'fixed'),
      this.createLine(templateId, '3ème pilier', 580, 'saving', 'fixed'),
    ];
  }

  private async createBudgets(
    userId: string,
    templates: TemplateRow[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetRow[]> {
    const currentDate = new Date();
    const budgetsToCreate: Omit<
      BudgetRow,
      'id' | 'created_at' | 'updated_at'
    >[] = [];

    // Create 6 past months + 6 future months
    for (let i = -6; i <= 5; i++) {
      const budgetDate = addMonths(startOfMonth(currentDate), i);
      const budget = this.createBudgetForMonth(userId, budgetDate, templates);
      budgetsToCreate.push(budget);
    }

    const { data, error } = await supabase
      .from('monthly_budget')
      .insert(budgetsToCreate)
      .select();

    if (error) throw error;
    return data;
  }

  private createBudgetForMonth(
    userId: string,
    budgetDate: Date,
    templates: TemplateRow[],
  ): Omit<BudgetRow, 'id' | 'created_at' | 'updated_at'> {
    const month = budgetDate.getMonth() + 1;
    const year = budgetDate.getFullYear();

    const { template, description } = this.selectTemplateForMonth(
      month,
      templates,
    );

    return {
      user_id: userId,
      month,
      year,
      description,
      template_id: template.id,
      ending_balance: null,
    };
  }

  /**
   * Selects the appropriate template for a given month
   *
   * NOTE: This uses European/Swiss calendar assumptions for demo realism:
   * - December: Holiday season (Christmas/New Year) → Uses holiday template
   * - July/August: Summer vacation period → Uses vacation template
   * - March/September: Financial planning months → Uses savings template
   * - Other months: Standard monthly template
   *
   * These assumptions reflect the target market (Switzerland) and create
   * realistic demo data variation throughout the year.
   */
  private selectTemplateForMonth(month: number, templates: TemplateRow[]) {
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

  private async createBudgetLines(
    budgets: BudgetRow[],
    templateLines: TemplateLineRow[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineRow[]> {
    const budgetLinesToCreate: Omit<
      BudgetLineRow,
      'id' | 'created_at' | 'updated_at'
    >[] = [];

    for (const budget of budgets) {
      const relevantTemplateLines = templateLines.filter(
        (tl) => tl.template_id === budget.template_id,
      );

      for (const templateLine of relevantTemplateLines) {
        budgetLinesToCreate.push({
          budget_id: budget.id,
          template_line_id: templateLine.id,
          savings_goal_id: null,
          name: templateLine.name,
          amount: templateLine.amount,
          kind: templateLine.kind,
          recurrence: templateLine.recurrence,
          is_manually_adjusted: false,
          checked_at: null,
        });
      }
    }

    const { data, error } = await supabase
      .from('budget_line')
      .insert(budgetLinesToCreate)
      .select();

    if (error) throw error;
    return data;
  }

  private async createTransactions(
    budgets: BudgetRow[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionRow[]> {
    const currentDate = new Date();
    const pastBudgets = this.filterPastBudgets(budgets, currentDate);
    const transactionsToCreate = this.generateTransactions(
      pastBudgets,
      currentDate,
    );

    if (transactionsToCreate.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('transaction')
      .insert(transactionsToCreate)
      .select();

    if (error) throw error;
    return data;
  }

  private filterPastBudgets(budgets: BudgetRow[], currentDate: Date) {
    return budgets.filter((b) => {
      const budgetDate = new Date(b.year, b.month - 1);
      return budgetDate <= currentDate;
    });
  }

  private generateTransactions(
    pastBudgets: BudgetRow[],
    currentDate: Date,
  ): Omit<TransactionRow, 'id' | 'created_at' | 'updated_at'>[] {
    const transactions: Omit<
      TransactionRow,
      'id' | 'created_at' | 'updated_at'
    >[] = [];

    for (const budget of pastBudgets) {
      const maxDay = this.calculateMaxDay(budget, currentDate);
      const budgetTransactions = this.createBudgetTransactions(budget, maxDay);
      transactions.push(...budgetTransactions);
    }

    return transactions;
  }

  private calculateMaxDay(budget: BudgetRow, currentDate: Date): number {
    const isCurrentMonth =
      budget.month === currentDate.getMonth() + 1 &&
      budget.year === currentDate.getFullYear();

    const daysInMonth = new Date(budget.year, budget.month, 0).getDate();
    return isCurrentMonth ? currentDate.getDate() : daysInMonth;
  }

  private createBudgetTransactions(
    budget: BudgetRow,
    maxDay: number,
  ): Omit<TransactionRow, 'id' | 'created_at' | 'updated_at'>[] {
    const transactions: Omit<
      TransactionRow,
      'id' | 'created_at' | 'updated_at'
    >[] = [];

    if (maxDay >= 5) {
      transactions.push(
        this.createTransaction(
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
        this.createTransaction(
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
        this.createTransaction(
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

  private createTransaction(
    budget: BudgetRow,
    day: number,
    name: string,
    amount: number,
    category: string,
  ): Omit<TransactionRow, 'id' | 'created_at' | 'updated_at'> {
    return {
      budget_id: budget.id,
      budget_line_id: null,
      name,
      amount,
      kind: 'expense',
      category,
      transaction_date: new Date(
        budget.year,
        budget.month - 1,
        day,
      ).toISOString(),
      checked_at: null,
    };
  }

  /**
   * Recalculates ending_balance for all budgets in chronological order
   * This ensures rollover values cascade correctly from oldest to newest
   */
  private async recalculateAllBudgetBalances(
    budgets: BudgetRow[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const sortedBudgets = [...budgets].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    for (const budget of sortedBudgets) {
      await this.budgetCalculator.recalculateAndPersist(budget.id, supabase);
    }
  }
}
