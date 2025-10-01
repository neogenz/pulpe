import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import type { AuthenticatedSupabaseClient } from '../supabase/supabase.service';
import { addMonths, startOfMonth } from 'date-fns';
import type { Tables } from '../../types/database.types';

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
    @InjectPinoLogger(DemoDataGeneratorService.name)
    private readonly logger: PinoLogger,
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

    try {
      // 1. Create templates
      const templates = await this.createTemplates(userId, supabase);
      this.logger.info(
        { userId, count: templates.length },
        'Templates created',
      );

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

      this.logger.info({ userId }, 'Demo data generation completed');
    } catch (error) {
      this.logger.error({ userId, error }, 'Failed to generate demo data');
      throw error;
    }
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
      // Income
      {
        template_id: templateId,
        name: 'Salaire net',
        amount: 6500,
        kind: 'income',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Freelance design',
        amount: 800,
        kind: 'income',
        recurrence: 'one_off',
        description: '',
      },
      // Fixed Expenses
      {
        template_id: templateId,
        name: 'Loyer',
        amount: 1850,
        kind: 'expense',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Charges',
        amount: 180,
        kind: 'expense',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Assurance maladie',
        amount: 385,
        kind: 'expense',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Abonnement mobile',
        amount: 69,
        kind: 'expense',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Internet & TV',
        amount: 89,
        kind: 'expense',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Abonnement CFF',
        amount: 185,
        kind: 'expense',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Assurance RC/Ménage',
        amount: 35,
        kind: 'expense',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Netflix & Spotify',
        amount: 38,
        kind: 'expense',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Salle de sport',
        amount: 99,
        kind: 'expense',
        recurrence: 'fixed',
        description: '',
      },
      // Variable Expenses
      {
        template_id: templateId,
        name: 'Courses alimentaires',
        amount: 600,
        kind: 'expense',
        recurrence: 'one_off',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Restaurants/Sorties',
        amount: 400,
        kind: 'expense',
        recurrence: 'one_off',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Shopping vêtements',
        amount: 200,
        kind: 'expense',
        recurrence: 'one_off',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Essence/Parking',
        amount: 150,
        kind: 'expense',
        recurrence: 'one_off',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Pharmacie/Santé',
        amount: 80,
        kind: 'expense',
        recurrence: 'one_off',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Coiffeur/Beauté',
        amount: 120,
        kind: 'expense',
        recurrence: 'one_off',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Divers/Imprévus',
        amount: 150,
        kind: 'expense',
        recurrence: 'one_off',
        description: '',
      },
      // Savings
      {
        template_id: templateId,
        name: 'Épargne logement',
        amount: 1000,
        kind: 'saving',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: '3ème pilier',
        amount: 580,
        kind: 'saving',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: "Fonds d'urgence",
        amount: 300,
        kind: 'saving',
        recurrence: 'fixed',
        description: '',
      },
    ];
  }

  private getVacationMonthLines(
    templateId: string,
  ): Omit<TemplateLineRow, 'id' | 'created_at' | 'updated_at'>[] {
    return [
      // Income
      {
        template_id: templateId,
        name: 'Salaire net',
        amount: 6500,
        kind: 'income',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: '13ème salaire',
        amount: 2500,
        kind: 'income',
        recurrence: 'one_off',
        description: '',
      },
      // Fixed expenses
      {
        template_id: templateId,
        name: 'Loyer',
        amount: 1850,
        kind: 'expense',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Charges',
        amount: 180,
        kind: 'expense',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Assurance maladie',
        amount: 385,
        kind: 'expense',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Abonnements divers',
        amount: 281,
        kind: 'expense',
        recurrence: 'fixed',
        description: '',
      },
      // Vacation expenses
      {
        template_id: templateId,
        name: "Billets d'avion",
        amount: 800,
        kind: 'expense',
        recurrence: 'one_off',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Hôtel (7 nuits)',
        amount: 1200,
        kind: 'expense',
        recurrence: 'one_off',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Budget vacances',
        amount: 1500,
        kind: 'expense',
        recurrence: 'one_off',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Assurance voyage',
        amount: 85,
        kind: 'expense',
        recurrence: 'one_off',
        description: '',
      },
      // Reduced savings
      {
        template_id: templateId,
        name: '3ème pilier',
        amount: 580,
        kind: 'saving',
        recurrence: 'fixed',
        description: '',
      },
    ];
  }

  private getSavingsMonthLines(
    templateId: string,
  ): Omit<TemplateLineRow, 'id' | 'created_at' | 'updated_at'>[] {
    return [
      // Income
      {
        template_id: templateId,
        name: 'Salaire net',
        amount: 6500,
        kind: 'income',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Vente Anibis',
        amount: 200,
        kind: 'income',
        recurrence: 'one_off',
        description: '',
      },
      // Minimal expenses
      {
        template_id: templateId,
        name: 'Loyer',
        amount: 1850,
        kind: 'expense',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Charges',
        amount: 180,
        kind: 'expense',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Assurance maladie',
        amount: 385,
        kind: 'expense',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Abonnements essentiels',
        amount: 154,
        kind: 'expense',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Courses (budget serré)',
        amount: 400,
        kind: 'expense',
        recurrence: 'one_off',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Transport',
        amount: 185,
        kind: 'expense',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Minimum vital',
        amount: 200,
        kind: 'expense',
        recurrence: 'one_off',
        description: '',
      },
      // Maximized savings
      {
        template_id: templateId,
        name: 'Épargne logement',
        amount: 1800,
        kind: 'saving',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: '3ème pilier',
        amount: 580,
        kind: 'saving',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Investissement ETF',
        amount: 500,
        kind: 'saving',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: "Fonds d'urgence",
        amount: 500,
        kind: 'saving',
        recurrence: 'fixed',
        description: '',
      },
    ];
  }

  private getHolidayMonthLines(
    templateId: string,
  ): Omit<TemplateLineRow, 'id' | 'created_at' | 'updated_at'>[] {
    return [
      // Income with bonus
      {
        template_id: templateId,
        name: 'Salaire net',
        amount: 6500,
        kind: 'income',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: "Prime de fin d'année",
        amount: 3000,
        kind: 'income',
        recurrence: 'one_off',
        description: '',
      },
      // Fixed expenses
      {
        template_id: templateId,
        name: 'Loyer',
        amount: 1850,
        kind: 'expense',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Charges',
        amount: 180,
        kind: 'expense',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Assurances diverses',
        amount: 420,
        kind: 'expense',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Abonnements',
        amount: 281,
        kind: 'expense',
        recurrence: 'fixed',
        description: '',
      },
      // Holiday expenses
      {
        template_id: templateId,
        name: 'Cadeaux famille',
        amount: 800,
        kind: 'expense',
        recurrence: 'one_off',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Cadeaux amis',
        amount: 400,
        kind: 'expense',
        recurrence: 'one_off',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Repas de fêtes',
        amount: 600,
        kind: 'expense',
        recurrence: 'one_off',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Décorations',
        amount: 150,
        kind: 'expense',
        recurrence: 'one_off',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Sorties festives',
        amount: 500,
        kind: 'expense',
        recurrence: 'one_off',
        description: '',
      },
      {
        template_id: templateId,
        name: 'Tenue de soirée',
        amount: 350,
        kind: 'expense',
        recurrence: 'one_off',
        description: '',
      },
      // Normal savings
      {
        template_id: templateId,
        name: 'Épargne logement',
        amount: 1000,
        kind: 'saving',
        recurrence: 'fixed',
        description: '',
      },
      {
        template_id: templateId,
        name: '3ème pilier',
        amount: 580,
        kind: 'saving',
        recurrence: 'fixed',
        description: '',
      },
    ];
  }

  private async createBudgets(
    userId: string,
    templates: TemplateRow[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetRow[]> {
    const budgetsToCreate: Omit<
      BudgetRow,
      'id' | 'created_at' | 'updated_at'
    >[] = [];
    const currentDate = new Date();

    // Create 6 past months + 6 future months
    for (let i = -6; i <= 5; i++) {
      const budgetDate = addMonths(startOfMonth(currentDate), i);
      const month = budgetDate.getMonth() + 1;
      const year = budgetDate.getFullYear();

      // Select template based on month
      let template: TemplateRow;
      let description: string;

      if (month === 12) {
        template = templates[3]; // Holiday
        description = "Budget des fêtes de fin d'année 🎄";
      } else if (month === 7 || month === 8) {
        template = templates[1]; // Vacation
        description = "Budget vacances d'été ☀️";
      } else if (month === 3 || month === 9) {
        template = templates[2]; // Savings
        description = "Focus sur l'épargne ce mois-ci 💪";
      } else {
        template = templates[0]; // Standard
        description = `Budget mensuel standard`;
      }

      budgetsToCreate.push({
        user_id: userId,
        month,
        year,
        description,
        template_id: template.id,
        ending_balance: null, // Will be calculated by backend
      });
    }

    const { data, error } = await supabase
      .from('monthly_budget')
      .insert(budgetsToCreate)
      .select();

    if (error) throw error;
    return data;
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
    const transactionsToCreate: Omit<
      TransactionRow,
      'id' | 'created_at' | 'updated_at'
    >[] = [];
    const currentDate = new Date();

    // Only create transactions for past and current months
    const pastBudgets = budgets.filter((b) => {
      const budgetDate = new Date(b.year, b.month - 1);
      return budgetDate <= currentDate;
    });

    for (const budget of pastBudgets) {
      const isCurrentMonth =
        budget.month === currentDate.getMonth() + 1 &&
        budget.year === currentDate.getFullYear();

      const daysInMonth = new Date(budget.year, budget.month, 0).getDate();
      const maxDay = isCurrentMonth ? currentDate.getDate() : daysInMonth;

      // Add some sample transactions
      if (maxDay >= 5) {
        transactionsToCreate.push({
          budget_id: budget.id,
          name: 'Migros - Courses',
          amount: 127.85,
          kind: 'expense',
          category: 'Alimentation',
          transaction_date: new Date(
            budget.year,
            budget.month - 1,
            5,
          ).toISOString(),
        });
      }

      if (maxDay >= 10) {
        transactionsToCreate.push({
          budget_id: budget.id,
          name: 'Restaurant Molino',
          amount: 78.5,
          kind: 'expense',
          category: 'Restaurants',
          transaction_date: new Date(
            budget.year,
            budget.month - 1,
            10,
          ).toISOString(),
        });
      }

      if (maxDay >= 15) {
        transactionsToCreate.push({
          budget_id: budget.id,
          name: 'Coop - Courses',
          amount: 94.2,
          kind: 'expense',
          category: 'Alimentation',
          transaction_date: new Date(
            budget.year,
            budget.month - 1,
            15,
          ).toISOString(),
        });
      }
    }

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
}
