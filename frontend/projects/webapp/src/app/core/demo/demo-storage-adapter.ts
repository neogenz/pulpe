import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { of, throwError, delay } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  type Budget,
  type BudgetTemplate,
  type TemplateLine,
  type BudgetLine,
  type Transaction,
  type BudgetDetailsResponse,
  type BudgetResponse,
  type BudgetListResponse,
  type BudgetTemplateListResponse,
  type BudgetTemplateResponse,
  type BudgetTemplateDeleteResponse,
  type TemplateLineListResponse,
  type TemplateLinesBulkUpdateResponse,
  type TemplateLinesBulkOperationsResponse,
  type TransactionListResponse,
  type BudgetLineResponse,
} from '@pulpe/shared';
import { DemoModeService } from './demo-mode.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Adaptateur qui simule les réponses API en utilisant localStorage
 * Ajoute un délai artificiel pour simuler la latence réseau
 */
@Injectable({
  providedIn: 'root',
})
export class DemoStorageAdapter {
  readonly #demoMode = inject(DemoModeService);

  // Délai artificiel pour simuler la latence réseau (ms)
  private readonly MOCK_DELAY = 300;

  /**
   * Simule une réponse API avec délai
   */
  private mockApiResponse<T>(data: T): Observable<T> {
    return of(data).pipe(delay(this.MOCK_DELAY));
  }

  /**
   * Récupère tous les budgets
   */
  getAllBudgets$(): Observable<BudgetListResponse> {
    const budgets = this.#demoMode.getDemoData<Budget[]>('budgets') || [];
    return this.mockApiResponse({
      success: true,
      data: budgets,
      message: 'Budgets récupérés avec succès',
    });
  }

  /**
   * Récupère un budget par ID
   */
  getBudgetById$(budgetId: string): Observable<BudgetResponse> {
    const budgets = this.#demoMode.getDemoData<Budget[]>('budgets') || [];
    const budget = budgets.find((b) => b.id === budgetId);

    if (!budget) {
      return throwError(() => ({
        message: 'Budget non trouvé',
      }));
    }

    return this.mockApiResponse({
      success: true,
      data: budget,
      message: 'Budget récupéré avec succès',
    });
  }

  /**
   * Récupère un budget avec ses détails (lignes et transactions)
   */
  getBudgetWithDetails$(budgetId: string): Observable<BudgetDetailsResponse> {
    const budgets = this.#demoMode.getDemoData<Budget[]>('budgets') || [];
    const budgetLines =
      this.#demoMode.getDemoData<BudgetLine[]>('budget-lines') || [];
    const transactions =
      this.#demoMode.getDemoData<Transaction[]>('transactions') || [];

    const budget = budgets.find((b) => b.id === budgetId);

    if (!budget) {
      return throwError(() => ({
        message: 'Budget non trouvé',
      }));
    }

    const budgetSpecificLines = budgetLines.filter(
      (bl) => bl.budgetId === budgetId,
    );
    const budgetSpecificTransactions = transactions.filter(
      (t) => t.budgetId === budgetId,
    );

    return this.mockApiResponse({
      success: true,
      data: {
        budget,
        budgetLines: budgetSpecificLines,
        transactions: budgetSpecificTransactions,
      },
      message: 'Détails du budget récupérés avec succès',
    });
  }

  /**
   * Crée un nouveau budget à partir d'un template
   */
  createBudget$(budgetData: {
    month: number;
    year: number;
    description?: string;
    templateId: string;
  }): Observable<BudgetResponse> {
    const budgets = this.#demoMode.getDemoData<Budget[]>('budgets') || [];
    const templates =
      this.#demoMode.getDemoData<BudgetTemplate[]>('templates') || [];
    const templateLines =
      this.#demoMode.getDemoData<TemplateLine[]>('template-lines') || [];
    const budgetLines =
      this.#demoMode.getDemoData<BudgetLine[]>('budget-lines') || [];

    const template = templates.find((t) => t.id === budgetData.templateId);
    if (!template) {
      return throwError(() => ({
        message: 'Template non trouvé',
      }));
    }

    // Créer le nouveau budget
    const newBudget: Budget = {
      id: uuidv4(),
      month: budgetData.month,
      year: budgetData.year,
      description: budgetData.description || template.description || '',
      templateId: budgetData.templateId,
      userId: 'demo-user-001',
      endingBalance: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Créer les lignes de budget à partir du template
    const templateSpecificLines = templateLines.filter(
      (tl) => tl.templateId === template.id,
    );
    const newBudgetLines: BudgetLine[] = templateSpecificLines.map((tl) => ({
      id: uuidv4(),
      budgetId: newBudget.id,
      templateLineId: tl.id,
      savingsGoalId: null,
      name: tl.name,
      amount: tl.amount,
      kind: tl.kind,
      recurrence: tl.recurrence,
      isManuallyAdjusted: false,
      isRollover: false,
      rolloverSourceBudgetId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    // Sauvegarder
    budgets.push(newBudget);
    budgetLines.push(...newBudgetLines);

    this.#demoMode.saveDemoData('budgets', budgets);
    this.#demoMode.saveDemoData('budget-lines', budgetLines);

    return this.mockApiResponse({
      success: true,
      data: newBudget,
      message: 'Budget créé avec succès',
    });
  }

  /**
   * Met à jour un budget
   */
  updateBudget$(
    budgetId: string,
    updateData: {
      month?: number;
      year?: number;
      description?: string;
    },
  ): Observable<BudgetResponse> {
    const budgets = this.#demoMode.getDemoData<Budget[]>('budgets') || [];
    const budgetIndex = budgets.findIndex((b) => b.id === budgetId);

    if (budgetIndex === -1) {
      return throwError(() => ({
        message: 'Budget non trouvé',
      }));
    }

    const updatedBudget = {
      ...budgets[budgetIndex],
      ...updateData,
      updatedAt: new Date().toISOString(),
    };

    budgets[budgetIndex] = updatedBudget;
    this.#demoMode.saveDemoData('budgets', budgets);

    return this.mockApiResponse({
      success: true,
      data: updatedBudget,
      message: 'Budget mis à jour avec succès',
    });
  }

  /**
   * Supprime un budget
   */
  deleteBudget$(budgetId: string): Observable<void> {
    const budgets = this.#demoMode.getDemoData<Budget[]>('budgets') || [];
    const budgetLines =
      this.#demoMode.getDemoData<BudgetLine[]>('budget-lines') || [];
    const transactions =
      this.#demoMode.getDemoData<Transaction[]>('transactions') || [];

    const filteredBudgets = budgets.filter((b) => b.id !== budgetId);
    const filteredBudgetLines = budgetLines.filter(
      (bl) => bl.budgetId !== budgetId,
    );
    const filteredTransactions = transactions.filter(
      (t) => t.budgetId !== budgetId,
    );

    this.#demoMode.saveDemoData('budgets', filteredBudgets);
    this.#demoMode.saveDemoData('budget-lines', filteredBudgetLines);
    this.#demoMode.saveDemoData('transactions', filteredTransactions);

    return this.mockApiResponse(undefined).pipe(map(() => void 0));
  }

  /**
   * Récupère tous les templates
   */
  getAllTemplates$(): Observable<BudgetTemplateListResponse> {
    const templates =
      this.#demoMode.getDemoData<BudgetTemplate[]>('templates') || [];
    return this.mockApiResponse({
      success: true,
      data: templates,
      message: 'Templates récupérés avec succès',
    });
  }

  /**
   * Récupère un template par ID
   */
  getTemplateById$(
    templateId: string,
  ): Observable<{ success: true; data: BudgetTemplate }> {
    const templates =
      this.#demoMode.getDemoData<BudgetTemplate[]>('templates') || [];
    const template = templates.find((t) => t.id === templateId);

    if (!template) {
      return throwError(() => ({
        message: 'Template non trouvé',
      }));
    }

    return this.mockApiResponse({
      success: true,
      data: template,
    });
  }

  /**
   * Récupère les lignes d'un template
   */
  getTemplateLines$(templateId: string): Observable<TemplateLineListResponse> {
    const templateLines =
      this.#demoMode.getDemoData<TemplateLine[]>('template-lines') || [];
    const lines = templateLines.filter((tl) => tl.templateId === templateId);

    return this.mockApiResponse({
      success: true,
      data: lines,
      message: 'Lignes du template récupérées avec succès',
    });
  }

  /**
   * Récupère les transactions d'un budget
   */
  getTransactionsByBudget$(
    budgetId: string,
  ): Observable<TransactionListResponse> {
    const transactions =
      this.#demoMode.getDemoData<Transaction[]>('transactions') || [];
    const budgetTransactions = transactions.filter(
      (t) => t.budgetId === budgetId,
    );

    return this.mockApiResponse({
      success: true,
      data: budgetTransactions,
      message: 'Transactions récupérées avec succès',
    });
  }

  /**
   * Crée une nouvelle transaction
   */
  createTransaction$(transaction: {
    budgetId: string;
    name: string;
    amount: number;
    kind: 'income' | 'expense' | 'saving';
    transactionDate?: string;
    category?: string | null;
  }): Observable<{ success: true; data: Transaction }> {
    const transactions =
      this.#demoMode.getDemoData<Transaction[]>('transactions') || [];

    const newTransaction: Transaction = {
      id: uuidv4(),
      ...transaction,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    transactions.push(newTransaction);
    this.#demoMode.saveDemoData('transactions', transactions);

    // Mettre à jour l'ending balance du budget
    this.updateBudgetEndingBalance(transaction.budgetId);

    return this.mockApiResponse({
      success: true,
      data: newTransaction,
    });
  }

  /**
   * Met à jour une transaction
   */
  updateTransaction$(
    id: string,
    updateData: {
      name?: string;
      amount?: number;
      kind?: 'income' | 'expense' | 'saving';
      transactionDate?: string;
      category?: string | null;
    },
  ): Observable<{ success: true; data: Transaction }> {
    const transactions =
      this.#demoMode.getDemoData<Transaction[]>('transactions') || [];
    const index = transactions.findIndex((t) => t.id === id);

    if (index === -1) {
      return throwError(() => ({
        message: 'Transaction non trouvée',
      }));
    }

    const updatedTransaction = {
      ...transactions[index],
      ...updateData,
      updatedAt: new Date().toISOString(),
    };

    transactions[index] = updatedTransaction;
    this.#demoMode.saveDemoData('transactions', transactions);

    // Mettre à jour l'ending balance du budget
    this.updateBudgetEndingBalance(updatedTransaction.budgetId);

    return this.mockApiResponse({
      success: true,
      data: updatedTransaction,
    });
  }

  /**
   * Supprime une transaction
   */
  deleteTransaction$(id: string): Observable<void> {
    const transactions =
      this.#demoMode.getDemoData<Transaction[]>('transactions') || [];
    const transaction = transactions.find((t) => t.id === id);

    if (!transaction) {
      return throwError(() => ({
        message: 'Transaction non trouvée',
      }));
    }

    const filteredTransactions = transactions.filter((t) => t.id !== id);
    this.#demoMode.saveDemoData('transactions', filteredTransactions);

    // Mettre à jour l'ending balance du budget
    this.updateBudgetEndingBalance(transaction.budgetId);

    return this.mockApiResponse(undefined).pipe(map(() => void 0));
  }

  /**
   * Crée une ligne de budget
   */
  createBudgetLine$(budgetLine: {
    budgetId: string;
    templateLineId?: string | null;
    savingsGoalId?: string | null;
    name: string;
    amount: number;
    kind: 'income' | 'expense' | 'saving';
    recurrence: 'fixed' | 'variable' | 'one_off';
    isManuallyAdjusted?: boolean;
    isRollover?: boolean;
    rolloverSourceBudgetId?: string | null;
  }): Observable<BudgetLineResponse> {
    const budgetLines =
      this.#demoMode.getDemoData<BudgetLine[]>('budget-lines') || [];

    const newBudgetLine: BudgetLine = {
      id: uuidv4(),
      ...budgetLine,
      templateLineId: budgetLine.templateLineId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    budgetLines.push(newBudgetLine);
    this.#demoMode.saveDemoData('budget-lines', budgetLines);

    // Mettre à jour l'ending balance du budget
    this.updateBudgetEndingBalance(budgetLine.budgetId);

    return this.mockApiResponse({
      success: true,
      data: newBudgetLine,
      message: 'Ligne de budget créée avec succès',
    });
  }

  /**
   * Met à jour une ligne de budget
   */
  updateBudgetLine$(
    id: string,
    updateData: {
      name?: string;
      amount?: number;
      kind?: 'income' | 'expense' | 'saving';
      recurrence?: 'fixed' | 'variable' | 'one_off';
      isManuallyAdjusted?: boolean;
    },
  ): Observable<BudgetLineResponse> {
    const budgetLines =
      this.#demoMode.getDemoData<BudgetLine[]>('budget-lines') || [];
    const index = budgetLines.findIndex((bl) => bl.id === id);

    if (index === -1) {
      return throwError(() => ({
        message: 'Ligne de budget non trouvée',
      }));
    }

    const updatedBudgetLine = {
      ...budgetLines[index],
      ...updateData,
      updatedAt: new Date().toISOString(),
    };

    budgetLines[index] = updatedBudgetLine;
    this.#demoMode.saveDemoData('budget-lines', budgetLines);

    // Mettre à jour l'ending balance du budget
    this.updateBudgetEndingBalance(updatedBudgetLine.budgetId);

    return this.mockApiResponse({
      success: true,
      data: updatedBudgetLine,
      message: 'Ligne de budget mise à jour avec succès',
    });
  }

  /**
   * Supprime une ligne de budget
   */
  deleteBudgetLine$(id: string): Observable<void> {
    const budgetLines =
      this.#demoMode.getDemoData<BudgetLine[]>('budget-lines') || [];
    const budgetLine = budgetLines.find((bl) => bl.id === id);

    if (!budgetLine) {
      return throwError(() => ({
        message: 'Ligne de budget non trouvée',
      }));
    }

    const filteredBudgetLines = budgetLines.filter((bl) => bl.id !== id);
    this.#demoMode.saveDemoData('budget-lines', filteredBudgetLines);

    // Mettre à jour l'ending balance du budget
    this.updateBudgetEndingBalance(budgetLine.budgetId);

    return this.mockApiResponse(undefined).pipe(map(() => void 0));
  }

  /**
   * Crée un nouveau template
   */
  createTemplate$(template: {
    name: string;
    description?: string;
    isDefault?: boolean;
    lines?: {
      name: string;
      amount: number;
      kind: 'income' | 'expense' | 'saving';
      recurrence: 'fixed' | 'variable' | 'one_off';
      description?: string;
    }[];
  }): Observable<{
    success: true;
    data: { template: BudgetTemplate; lines: TemplateLine[] };
  }> {
    const templates =
      this.#demoMode.getDemoData<BudgetTemplate[]>('templates') || [];
    const templateLines =
      this.#demoMode.getDemoData<TemplateLine[]>('template-lines') || [];

    const newTemplate: BudgetTemplate = {
      id: uuidv4(),
      name: template.name,
      description: template.description,
      isDefault: template.isDefault,
      userId: 'demo-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Create template lines if provided
    const createdLines: TemplateLine[] = [];
    if (template.lines && template.lines.length > 0) {
      for (const line of template.lines) {
        const newLine = {
          id: uuidv4(),
          templateId: newTemplate.id,
          ...line,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        createdLines.push(newLine);
        templateLines.push(newLine);
      }
      this.#demoMode.saveDemoData('template-lines', templateLines);
    }

    templates.push(newTemplate);
    this.#demoMode.saveDemoData('templates', templates);

    return this.mockApiResponse({
      success: true,
      data: {
        template: newTemplate,
        lines: createdLines,
      },
    });
  }

  /**
   * Met à jour un template
   */
  updateTemplate$(
    id: string,
    updates: {
      name?: string;
      description?: string;
      isDefault?: boolean;
    },
  ): Observable<BudgetTemplateResponse> {
    const templates =
      this.#demoMode.getDemoData<BudgetTemplate[]>('templates') || [];
    const index = templates.findIndex((t) => t.id === id);

    if (index === -1) {
      return throwError(() => ({
        message: 'Template non trouvé',
      }));
    }

    const updatedTemplate = {
      ...templates[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    templates[index] = updatedTemplate;
    this.#demoMode.saveDemoData('templates', templates);

    return this.mockApiResponse({
      success: true,
      data: updatedTemplate,
    });
  }

  /**
   * Supprime un template
   */
  deleteTemplate$(id: string): Observable<BudgetTemplateDeleteResponse> {
    const templates =
      this.#demoMode.getDemoData<BudgetTemplate[]>('templates') || [];
    const templateLines =
      this.#demoMode.getDemoData<TemplateLine[]>('template-lines') || [];

    const template = templates.find((t) => t.id === id);
    if (!template) {
      return throwError(() => ({
        message: 'Template non trouvé',
      }));
    }

    // Supprimer le template
    const filteredTemplates = templates.filter((t) => t.id !== id);
    this.#demoMode.saveDemoData('templates', filteredTemplates);

    // Supprimer les lignes associées
    const filteredLines = templateLines.filter((l) => l.templateId !== id);
    this.#demoMode.saveDemoData('template-lines', filteredLines);

    return this.mockApiResponse({
      success: true,
      message: 'Template supprimé avec succès',
    });
  }

  /**
   * Met à jour les lignes d'un template
   */
  updateTemplateLines$(
    templateId: string,
    bulkUpdate: {
      lines?: {
        id: string;
        name?: string;
        amount?: number;
        kind?: 'income' | 'expense' | 'saving';
        recurrence?: 'fixed' | 'variable' | 'one_off';
        description?: string;
      }[];
    },
  ): Observable<TemplateLinesBulkUpdateResponse> {
    const templateLines =
      this.#demoMode.getDemoData<TemplateLine[]>('template-lines') || [];

    // Pour chaque ligne à mettre à jour
    if (bulkUpdate.lines) {
      bulkUpdate.lines.forEach((lineUpdate) => {
        const index = templateLines.findIndex((l) => l.id === lineUpdate.id);
        if (index !== -1) {
          templateLines[index] = {
            ...templateLines[index],
            ...lineUpdate,
            updatedAt: new Date().toISOString(),
          };
        }
      });
    }

    this.#demoMode.saveDemoData('template-lines', templateLines);

    const updatedLines = templateLines.filter(
      (l) => l.templateId === templateId,
    );

    return this.mockApiResponse({
      success: true,
      data: updatedLines,
      message: 'Lignes mises à jour avec succès',
    });
  }

  /**
   * Effectue des opérations en masse sur les lignes d'un template
   */
  bulkOperationsTemplateLines$(
    templateId: string,
    operations: {
      create?: {
        name: string;
        amount: number;
        kind: 'income' | 'expense' | 'saving';
        recurrence: 'fixed' | 'variable' | 'one_off';
        description: string;
      }[];
      update?: {
        id: string;
        name?: string;
        amount?: number;
        kind?: 'income' | 'expense' | 'saving';
        recurrence?: 'fixed' | 'variable' | 'one_off';
        description?: string;
      }[];
      delete?: string[];
    },
  ): Observable<TemplateLinesBulkOperationsResponse> {
    let templateLines =
      this.#demoMode.getDemoData<TemplateLine[]>('template-lines') || [];

    // Créer de nouvelles lignes
    if (operations.create) {
      operations.create.forEach((lineData) => {
        const newLine: TemplateLine = {
          id: uuidv4(),
          templateId,
          ...lineData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        templateLines.push(newLine);
      });
    }

    // Mettre à jour des lignes existantes
    if (operations.update) {
      operations.update.forEach((lineUpdate) => {
        const index = templateLines.findIndex((l) => l.id === lineUpdate.id);
        if (index !== -1) {
          templateLines[index] = {
            ...templateLines[index],
            ...lineUpdate,
            updatedAt: new Date().toISOString(),
          };
        }
      });
    }

    // Supprimer des lignes
    if (operations.delete) {
      templateLines = templateLines.filter(
        (l) => !operations.delete.includes(l.id),
      );
    }

    this.#demoMode.saveDemoData('template-lines', templateLines);

    return this.mockApiResponse({
      success: true,
      data: {
        created: operations.create || [],
        updated: operations.update || [],
        deleted: operations.delete || [],
      },
      message: 'Opérations effectuées avec succès',
    });
  }

  /**
   * Met à jour l'ending balance d'un budget basé sur ses transactions et lignes
   */
  private updateBudgetEndingBalance(budgetId: string): void {
    const budgets = this.#demoMode.getDemoData<Budget[]>('budgets') || [];
    const budgetLines =
      this.#demoMode.getDemoData<BudgetLine[]>('budget-lines') || [];
    const transactions =
      this.#demoMode.getDemoData<Transaction[]>('transactions') || [];

    const budgetIndex = budgets.findIndex((b) => b.id === budgetId);
    if (budgetIndex === -1) return;

    const budget = budgets[budgetIndex];
    const lines = budgetLines.filter((bl) => bl.budgetId === budgetId);
    const trans = transactions.filter((t) => t.budgetId === budgetId);

    // Calculer le total des revenus
    const incomeFromLines = lines
      .filter((l) => l.kind === 'income')
      .reduce((sum, l) => sum + l.amount, 0);
    const incomeFromTransactions = trans
      .filter((t) => t.kind === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalIncome = incomeFromLines + incomeFromTransactions;

    // Calculer le total des dépenses
    const expensesFromLines = lines
      .filter((l) => l.kind === 'expense')
      .reduce((sum, l) => sum + l.amount, 0);
    const expensesFromTransactions = trans
      .filter((t) => t.kind === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = expensesFromLines + expensesFromTransactions;

    // Calculer le total de l'épargne
    const savingsFromLines = lines
      .filter((l) => l.kind === 'saving')
      .reduce((sum, l) => sum + l.amount, 0);
    const savingsFromTransactions = trans
      .filter((t) => t.kind === 'saving')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalSavings = savingsFromLines + savingsFromTransactions;

    // Calculer l'ending balance
    budget.endingBalance = totalIncome - totalExpenses - totalSavings;
    budget.updatedAt = new Date().toISOString();

    budgets[budgetIndex] = budget;
    this.#demoMode.saveDemoData('budgets', budgets);
  }
}
