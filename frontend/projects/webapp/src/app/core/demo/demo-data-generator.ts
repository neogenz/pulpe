import { Injectable } from '@angular/core';
import {
  type Budget,
  type BudgetTemplate,
  type TemplateLine,
  type BudgetLine,
  type Transaction,
  type TransactionKind,
  type TransactionRecurrence,
} from '@pulpe/shared';
import { addMonths, startOfMonth, subMonths } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

export interface DemoUser {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface DemoSession {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  refresh_token: string;
  user: DemoUser;
}

@Injectable({
  providedIn: 'root',
})
export class DemoDataGenerator {
  private readonly userId = 'demo-user-001';
  private readonly currentDate = new Date();
  private readonly currentMonth = this.currentDate.getMonth() + 1;
  private readonly currentYear = this.currentDate.getFullYear();

  /**
   * Génère toutes les données de démonstration
   */
  generateAllDemoData(): {
    user: DemoUser;
    session: DemoSession;
    templates: BudgetTemplate[];
    templateLines: TemplateLine[];
    budgets: Budget[];
    budgetLines: BudgetLine[];
    transactions: Transaction[];
  } {
    const user = this.generateDemoUser();
    const session = this.generateDemoSession(user);
    const templates = this.generateTemplates();
    const templateLines = this.generateTemplateLines(templates);
    const { budgets, budgetLines } = this.generateBudgetsWithLines(templates);
    const transactions = this.generateTransactions(budgets);

    return {
      user,
      session,
      templates,
      templateLines,
      budgets,
      budgetLines,
      transactions,
    };
  }

  /**
   * Génère un utilisateur de démonstration
   */
  private generateDemoUser(): DemoUser {
    return {
      id: this.userId,
      email: 'demo@pulpe.app',
      name: 'Marie Démo',
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Génère une session de démonstration
   */
  private generateDemoSession(user: DemoUser): DemoSession {
    return {
      access_token: 'demo-token-' + uuidv4(),
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'demo-refresh-' + uuidv4(),
      user,
    };
  }

  /**
   * Génère des templates variés pour montrer les différentes possibilités
   */
  private generateTemplates(): BudgetTemplate[] {
    return [
      {
        id: 'template-001',
        name: '💰 Mois Standard',
        description:
          'Mon budget mensuel habituel avec toutes mes dépenses récurrentes',
        isDefault: true,
        userId: this.userId,
        createdAt: subMonths(this.currentDate, 6).toISOString(),
        updatedAt: subMonths(this.currentDate, 1).toISOString(),
      },
      {
        id: 'template-002',
        name: '✈️ Mois Vacances',
        description:
          'Budget spécial pour les mois avec voyages et sorties supplémentaires',
        isDefault: false,
        userId: this.userId,
        createdAt: subMonths(this.currentDate, 4).toISOString(),
        updatedAt: subMonths(this.currentDate, 2).toISOString(),
      },
      {
        id: 'template-003',
        name: '🎯 Mois Économies Renforcées',
        description:
          "Focus sur l'épargne avec réduction des dépenses variables",
        isDefault: false,
        userId: this.userId,
        createdAt: subMonths(this.currentDate, 3).toISOString(),
        updatedAt: subMonths(this.currentDate, 1).toISOString(),
      },
      {
        id: 'template-004',
        name: '🎄 Mois de Fêtes',
        description:
          'Budget adapté pour les périodes de fêtes avec cadeaux et repas',
        isDefault: false,
        userId: this.userId,
        createdAt: subMonths(this.currentDate, 2).toISOString(),
        updatedAt: subMonths(this.currentDate, 1).toISOString(),
      },
    ];
  }

  /**
   * Génère les lignes de template avec des montants réalistes suisses
   */
  private generateTemplateLines(templates: BudgetTemplate[]): TemplateLine[] {
    const lines: TemplateLine[] = [];

    // Template 1: Mois Standard
    const standardLines: Partial<TemplateLine>[] = [
      // Revenus
      {
        name: 'Salaire net',
        amount: 6500,
        kind: 'income',
        recurrence: 'fixed',
      },
      {
        name: 'Freelance design',
        amount: 800,
        kind: 'income',
        recurrence: 'variable',
      },

      // Dépenses fixes
      { name: 'Loyer', amount: 1850, kind: 'expense', recurrence: 'fixed' },
      { name: 'Charges', amount: 180, kind: 'expense', recurrence: 'fixed' },
      {
        name: 'Assurance maladie',
        amount: 385,
        kind: 'expense',
        recurrence: 'fixed',
      },
      {
        name: 'Abonnement mobile',
        amount: 69,
        kind: 'expense',
        recurrence: 'fixed',
      },
      {
        name: 'Internet & TV',
        amount: 89,
        kind: 'expense',
        recurrence: 'fixed',
      },
      {
        name: 'Abonnement CFF',
        amount: 185,
        kind: 'expense',
        recurrence: 'fixed',
      },
      {
        name: 'Assurance RC/Ménage',
        amount: 35,
        kind: 'expense',
        recurrence: 'fixed',
      },
      {
        name: 'Netflix & Spotify',
        amount: 38,
        kind: 'expense',
        recurrence: 'fixed',
      },
      {
        name: 'Salle de sport',
        amount: 99,
        kind: 'expense',
        recurrence: 'fixed',
      },

      // Dépenses variables
      {
        name: 'Courses alimentaires',
        amount: 600,
        kind: 'expense',
        recurrence: 'variable',
      },
      {
        name: 'Restaurants/Sorties',
        amount: 400,
        kind: 'expense',
        recurrence: 'variable',
      },
      {
        name: 'Shopping vêtements',
        amount: 200,
        kind: 'expense',
        recurrence: 'variable',
      },
      {
        name: 'Essence/Parking',
        amount: 150,
        kind: 'expense',
        recurrence: 'variable',
      },
      {
        name: 'Pharmacie/Santé',
        amount: 80,
        kind: 'expense',
        recurrence: 'variable',
      },
      {
        name: 'Coiffeur/Beauté',
        amount: 120,
        kind: 'expense',
        recurrence: 'variable',
      },
      {
        name: 'Divers/Imprévus',
        amount: 150,
        kind: 'expense',
        recurrence: 'variable',
      },

      // Épargne
      {
        name: 'Épargne logement',
        amount: 1000,
        kind: 'saving',
        recurrence: 'fixed',
      },
      { name: '3ème pilier', amount: 580, kind: 'saving', recurrence: 'fixed' },
      {
        name: "Fonds d'urgence",
        amount: 300,
        kind: 'saving',
        recurrence: 'fixed',
      },
    ];

    // Template 2: Mois Vacances
    const vacationLines: Partial<TemplateLine>[] = [
      // Revenus identiques
      {
        name: 'Salaire net',
        amount: 6500,
        kind: 'income',
        recurrence: 'fixed',
      },
      {
        name: '13ème salaire',
        amount: 2500,
        kind: 'income',
        recurrence: 'one_off',
      },

      // Dépenses fixes (identiques)
      { name: 'Loyer', amount: 1850, kind: 'expense', recurrence: 'fixed' },
      { name: 'Charges', amount: 180, kind: 'expense', recurrence: 'fixed' },
      {
        name: 'Assurance maladie',
        amount: 385,
        kind: 'expense',
        recurrence: 'fixed',
      },
      {
        name: 'Abonnements divers',
        amount: 281,
        kind: 'expense',
        recurrence: 'fixed',
      },

      // Dépenses vacances
      {
        name: "Billets d'avion",
        amount: 800,
        kind: 'expense',
        recurrence: 'one_off',
      },
      {
        name: 'Hôtel (7 nuits)',
        amount: 1200,
        kind: 'expense',
        recurrence: 'one_off',
      },
      {
        name: 'Budget vacances',
        amount: 1500,
        kind: 'expense',
        recurrence: 'one_off',
      },
      {
        name: 'Assurance voyage',
        amount: 85,
        kind: 'expense',
        recurrence: 'one_off',
      },

      // Épargne réduite
      { name: '3ème pilier', amount: 580, kind: 'saving', recurrence: 'fixed' },
    ];

    // Template 3: Mois Économies Renforcées
    const savingsLines: Partial<TemplateLine>[] = [
      // Revenus
      {
        name: 'Salaire net',
        amount: 6500,
        kind: 'income',
        recurrence: 'fixed',
      },
      {
        name: 'Vente Anibis',
        amount: 200,
        kind: 'income',
        recurrence: 'one_off',
      },

      // Dépenses minimales
      { name: 'Loyer', amount: 1850, kind: 'expense', recurrence: 'fixed' },
      { name: 'Charges', amount: 180, kind: 'expense', recurrence: 'fixed' },
      {
        name: 'Assurance maladie',
        amount: 385,
        kind: 'expense',
        recurrence: 'fixed',
      },
      {
        name: 'Abonnements essentiels',
        amount: 154,
        kind: 'expense',
        recurrence: 'fixed',
      },
      {
        name: 'Courses (budget serré)',
        amount: 400,
        kind: 'expense',
        recurrence: 'variable',
      },
      { name: 'Transport', amount: 185, kind: 'expense', recurrence: 'fixed' },
      {
        name: 'Minimum vital',
        amount: 200,
        kind: 'expense',
        recurrence: 'variable',
      },

      // Épargne maximisée
      {
        name: 'Épargne logement',
        amount: 1800,
        kind: 'saving',
        recurrence: 'fixed',
      },
      { name: '3ème pilier', amount: 580, kind: 'saving', recurrence: 'fixed' },
      {
        name: 'Investissement ETF',
        amount: 500,
        kind: 'saving',
        recurrence: 'fixed',
      },
      {
        name: "Fonds d'urgence",
        amount: 500,
        kind: 'saving',
        recurrence: 'fixed',
      },
    ];

    // Template 4: Mois de Fêtes
    const holidayLines: Partial<TemplateLine>[] = [
      // Revenus avec bonus
      {
        name: 'Salaire net',
        amount: 6500,
        kind: 'income',
        recurrence: 'fixed',
      },
      {
        name: "Prime de fin d'année",
        amount: 3000,
        kind: 'income',
        recurrence: 'one_off',
      },

      // Dépenses fixes
      { name: 'Loyer', amount: 1850, kind: 'expense', recurrence: 'fixed' },
      { name: 'Charges', amount: 180, kind: 'expense', recurrence: 'fixed' },
      {
        name: 'Assurances diverses',
        amount: 420,
        kind: 'expense',
        recurrence: 'fixed',
      },
      {
        name: 'Abonnements',
        amount: 281,
        kind: 'expense',
        recurrence: 'fixed',
      },

      // Dépenses de fêtes
      {
        name: 'Cadeaux famille',
        amount: 800,
        kind: 'expense',
        recurrence: 'one_off',
      },
      {
        name: 'Cadeaux amis',
        amount: 400,
        kind: 'expense',
        recurrence: 'one_off',
      },
      {
        name: 'Repas de fêtes',
        amount: 600,
        kind: 'expense',
        recurrence: 'one_off',
      },
      {
        name: 'Décorations',
        amount: 150,
        kind: 'expense',
        recurrence: 'one_off',
      },
      {
        name: 'Sorties festives',
        amount: 500,
        kind: 'expense',
        recurrence: 'variable',
      },
      {
        name: 'Tenue de soirée',
        amount: 350,
        kind: 'expense',
        recurrence: 'one_off',
      },

      // Épargne normale
      {
        name: 'Épargne logement',
        amount: 1000,
        kind: 'saving',
        recurrence: 'fixed',
      },
      { name: '3ème pilier', amount: 580, kind: 'saving', recurrence: 'fixed' },
    ];

    // Assigner les lignes aux templates
    const allTemplateLines = [
      { templateId: templates[0].id, lines: standardLines },
      { templateId: templates[1].id, lines: vacationLines },
      { templateId: templates[2].id, lines: savingsLines },
      { templateId: templates[3].id, lines: holidayLines },
    ];

    allTemplateLines.forEach(({ templateId, lines: templateSpecificLines }) => {
      templateSpecificLines.forEach((line, index) => {
        lines.push({
          id: `line-${templateId}-${index}`,
          templateId,
          name: line.name!,
          amount: line.amount!,
          kind: line.kind as TransactionKind,
          recurrence: line.recurrence as TransactionRecurrence,
          description: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });
    });

    return lines;
  }

  /**
   * Génère 12 mois de budgets avec variations réalistes
   */
  private generateBudgetsWithLines(templates: BudgetTemplate[]): {
    budgets: Budget[];
    budgetLines: BudgetLine[];
  } {
    const budgets: Budget[] = [];
    const budgetLines: BudgetLine[] = [];

    // Générer les 6 derniers mois + 6 mois futurs
    for (let i = -6; i <= 5; i++) {
      const budgetDate = addMonths(startOfMonth(this.currentDate), i);
      const month = budgetDate.getMonth() + 1;
      const year = budgetDate.getFullYear();

      // Choisir le template selon le mois
      let templateId: string;
      let description: string;

      if (month === 12) {
        // Décembre = template fêtes
        templateId = templates[3].id;
        description = "Budget des fêtes de fin d'année 🎄";
      } else if (month === 7 || month === 8) {
        // Juillet/Août = template vacances
        templateId = templates[1].id;
        description = "Budget vacances d'été ☀️";
      } else if (month === 3 || month === 9) {
        // Mars/Septembre = template économies
        templateId = templates[2].id;
        description = "Focus sur l'épargne ce mois-ci 💪";
      } else {
        // Autres mois = template standard
        templateId = templates[0].id;
        description = `Budget mensuel standard`;
      }

      const budgetId = `budget-${year}-${month.toString().padStart(2, '0')}`;

      // Calculer l'ending balance avec variations
      let endingBalance = 0;
      if (i < 0) {
        // Mois passés : variations réalistes
        const variation = Math.random() * 600 - 300; // Entre -300 et +300
        endingBalance = 200 + variation;
      }

      const budget: Budget = {
        id: budgetId,
        month,
        year,
        description,
        templateId,
        userId: this.userId,
        endingBalance: i < 0 ? endingBalance : null,
        createdAt: subMonths(this.currentDate, Math.abs(i) + 1).toISOString(),
        updatedAt: subMonths(this.currentDate, Math.abs(i)).toISOString(),
      };

      budgets.push(budget);

      // Créer les lignes de budget basées sur le template
      const templateLines = this.generateTemplateLines(templates).filter(
        (line) => line.templateId === templateId,
      );

      templateLines.forEach((templateLine, index) => {
        // Ajouter des variations pour les mois passés
        let amount = templateLine.amount;
        if (i < 0 && templateLine.recurrence === 'variable') {
          // Variations de ±20% sur les dépenses variables
          const variation = 1 + (Math.random() * 0.4 - 0.2);
          amount = Math.round(amount * variation);
        }

        const budgetLine: BudgetLine = {
          id: `budget-line-${budgetId}-${index}`,
          budgetId,
          templateLineId: templateLine.id,
          savingsGoalId: null,
          name: templateLine.name,
          amount,
          kind: templateLine.kind,
          recurrence: templateLine.recurrence,
          isManuallyAdjusted: false,
          createdAt: budget.createdAt,
          updatedAt: budget.updatedAt,
        };

        budgetLines.push(budgetLine);
      });
    }

    return { budgets, budgetLines };
  }

  /**
   * Génère des transactions réalistes pour les mois passés
   */
  private generateTransactions(budgets: Budget[]): Transaction[] {
    const transactions: Transaction[] = [];

    // Générer des transactions seulement pour les mois passés et le mois en cours
    const pastAndCurrentBudgets = budgets.filter((b) => {
      const budgetDate = new Date(b.year, b.month - 1);
      return budgetDate <= this.currentDate;
    });

    pastAndCurrentBudgets.forEach((budget) => {
      const isCurrentMonth =
        budget.month === this.currentMonth && budget.year === this.currentYear;

      // Transactions diverses pour montrer les fonctionnalités
      const monthTransactions: Partial<Transaction>[] = [];

      // Ajouter des transactions réalistes selon le jour du mois
      const daysInMonth = new Date(budget.year, budget.month, 0).getDate();
      const maxDay = isCurrentMonth ? this.currentDate.getDate() : daysInMonth;

      // Quelques achats réguliers
      if (maxDay >= 5) {
        monthTransactions.push({
          name: 'Migros - Courses',
          amount: 127.85,
          kind: 'expense',
          category: 'Alimentation',
          transactionDate: new Date(
            budget.year,
            budget.month - 1,
            5,
          ).toISOString(),
        });
      }

      if (maxDay >= 8) {
        monthTransactions.push({
          name: 'Coop - Alimentation',
          amount: 89.4,
          kind: 'expense',
          category: 'Alimentation',
          transactionDate: new Date(
            budget.year,
            budget.month - 1,
            8,
          ).toISOString(),
        });
      }

      if (maxDay >= 10) {
        monthTransactions.push({
          name: 'Restaurant Helvetia',
          amount: 85.0,
          kind: 'expense',
          category: 'Restaurants',
          transactionDate: new Date(
            budget.year,
            budget.month - 1,
            10,
          ).toISOString(),
        });
      }

      if (maxDay >= 12) {
        monthTransactions.push({
          name: 'Essence Shell',
          amount: 95.2,
          kind: 'expense',
          category: 'Transport',
          transactionDate: new Date(
            budget.year,
            budget.month - 1,
            12,
          ).toISOString(),
        });
      }

      if (maxDay >= 15) {
        monthTransactions.push({
          name: 'H&M',
          amount: 149.9,
          kind: 'expense',
          category: 'Shopping',
          transactionDate: new Date(
            budget.year,
            budget.month - 1,
            15,
          ).toISOString(),
        });

        monthTransactions.push({
          name: 'Denner',
          amount: 45.75,
          kind: 'expense',
          category: 'Alimentation',
          transactionDate: new Date(
            budget.year,
            budget.month - 1,
            15,
          ).toISOString(),
        });
      }

      if (maxDay >= 18) {
        monthTransactions.push({
          name: 'Pharmacie Sun Store',
          amount: 38.5,
          kind: 'expense',
          category: 'Santé',
          transactionDate: new Date(
            budget.year,
            budget.month - 1,
            18,
          ).toISOString(),
        });
      }

      if (maxDay >= 20) {
        monthTransactions.push({
          name: 'Cinéma Pathé',
          amount: 38.0,
          kind: 'expense',
          category: 'Loisirs',
          transactionDate: new Date(
            budget.year,
            budget.month - 1,
            20,
          ).toISOString(),
        });

        monthTransactions.push({
          name: 'Migros - Courses',
          amount: 156.3,
          kind: 'expense',
          category: 'Alimentation',
          transactionDate: new Date(
            budget.year,
            budget.month - 1,
            20,
          ).toISOString(),
        });
      }

      if (maxDay >= 22) {
        monthTransactions.push({
          name: 'Restaurant Chez Luigi',
          amount: 120.0,
          kind: 'expense',
          category: 'Restaurants',
          transactionDate: new Date(
            budget.year,
            budget.month - 1,
            22,
          ).toISOString(),
        });
      }

      if (maxDay >= 25) {
        monthTransactions.push({
          name: 'Remboursement assurance',
          amount: 250.0,
          kind: 'income',
          category: 'Remboursements',
          transactionDate: new Date(
            budget.year,
            budget.month - 1,
            25,
          ).toISOString(),
        });

        monthTransactions.push({
          name: 'Coiffeur Style',
          amount: 85.0,
          kind: 'expense',
          category: 'Bien-être',
          transactionDate: new Date(
            budget.year,
            budget.month - 1,
            25,
          ).toISOString(),
        });
      }

      if (maxDay >= 28) {
        monthTransactions.push({
          name: 'Aldi',
          amount: 67.9,
          kind: 'expense',
          category: 'Alimentation',
          transactionDate: new Date(
            budget.year,
            budget.month - 1,
            28,
          ).toISOString(),
        });
      }

      // Ajouter quelques transactions exceptionnelles selon le mois
      if (budget.month === 12 && maxDay >= 15) {
        monthTransactions.push({
          name: 'Manor - Cadeaux Noël',
          amount: 285.0,
          kind: 'expense',
          category: 'Cadeaux',
          transactionDate: new Date(
            budget.year,
            budget.month - 1,
            15,
          ).toISOString(),
        });
      }

      if ((budget.month === 7 || budget.month === 8) && maxDay >= 10) {
        monthTransactions.push({
          name: 'Location kayak',
          amount: 120.0,
          kind: 'expense',
          category: 'Loisirs',
          transactionDate: new Date(
            budget.year,
            budget.month - 1,
            10,
          ).toISOString(),
        });
      }

      // Créer les transactions avec des IDs uniques
      monthTransactions.forEach((trans, index) => {
        transactions.push({
          id: `trans-${budget.id}-${index}`,
          budgetId: budget.id,
          name: trans.name!,
          amount: trans.amount!,
          kind: trans.kind as TransactionKind,
          category: trans.category!,
          transactionDate: trans.transactionDate!,
          createdAt: trans.transactionDate!,
          updatedAt: trans.transactionDate!,
        });
      });
    });

    return transactions;
  }
}
