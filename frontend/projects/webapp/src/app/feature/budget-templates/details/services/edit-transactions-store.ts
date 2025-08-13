import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BudgetTemplatesApi } from '../../services/budget-templates-api';
import type { TransactionFormData } from '../../services/transaction-form';
import type {
  TemplateLine,
  TemplateLinesBulkOperations,
  TemplateLineCreateWithoutTemplateId,
  TemplateLineUpdateWithId,
} from '@pulpe/shared';
import type {
  EditableTransaction,
  SaveResult,
} from './edit-transactions-state.interface';

/**
 * EditTransactionsStore - Signal-based state management for editing template transactions
 *
 * This store manages the editing of template transactions including:
 * - CRUD operations on editable transactions
 * - Bulk operations for efficient API calls
 * - Form validation and state tracking
 * - Optimistic updates and error handling
 *
 * Architecture:
 * - Individual signals for each state aspect (already conforms to pattern)
 * - Public computed selectors for reactive data access
 * - Actions for state mutations with strict immutability
 * - Efficient bulk operations for API calls
 */
@Injectable()
export class EditTransactionsStore {
  readonly #budgetTemplatesApi = inject(BudgetTemplatesApi);

  // Core state signals
  readonly #transactions = signal<EditableTransaction[]>([]);
  readonly #isLoading = signal(false);
  readonly #error = signal<string | null>(null);

  // Public readonly computed state
  readonly transactions = this.#transactions.asReadonly();
  readonly isLoading = this.#isLoading.asReadonly();
  readonly error = this.#error.asReadonly();

  // Derived computed signals
  readonly activeTransactions = computed(() =>
    this.transactions().filter((t) => !t.isDeleted),
  );

  readonly transactionCount = computed(() => this.activeTransactions().length);

  readonly canRemoveTransaction = computed(() => this.transactionCount() > 1);

  readonly hasUnsavedChanges = computed(() => this.#computeHasChanges());

  readonly isValid = computed(() => this.#computeIsValid());

  // Computed bulk operations for performance (memoized)
  readonly pendingOperations = computed(() => {
    const transactions = this.#transactions();
    return this.#generateBulkOperations(transactions);
  });

  /**
   * Initialize the state with template lines and form data.
   */
  initialize(
    templateLines: TemplateLine[],
    formData: TransactionFormData[],
  ): void {
    const editableTransactions = formData.map((data, index) => {
      const originalLine = templateLines[index];
      return this.#createEditableTransaction(data, originalLine);
    });

    this.#transactions.set(editableTransactions);
    this.#clearError();
  }

  /**
   * Add a new transaction to the list.
   */
  addTransaction(data: TransactionFormData): string {
    const newTransaction = this.#createEditableTransaction(data);
    this.#transactions.update((transactions) => [
      ...transactions,
      newTransaction,
    ]);
    return newTransaction.id;
  }

  /**
   * Update an existing transaction by ID.
   */
  updateTransaction(
    id: string,
    updates: Partial<TransactionFormData>,
  ): boolean {
    const found = this.#findTransactionById(id);

    // Don't allow updating deleted transactions
    if (!found || found.transaction.isDeleted) {
      return false;
    }

    return this.#updateTransactionById(id, (transaction) => ({
      ...transaction,
      formData: { ...transaction.formData, ...updates },
    }));
  }

  /**
   * Remove a transaction by ID.
   * For new transactions, removes them entirely. For existing transactions, marks as deleted.
   */
  removeTransaction(id: string): boolean {
    if (!this.canRemoveTransaction()) {
      return false;
    }

    return this.#updateTransactionById(
      id,
      (transaction) =>
        transaction.isNew
          ? null // Remove entirely
          : { ...transaction, isDeleted: true }, // Mark as deleted
    );
  }

  /**
   * Save all changes by calling the bulk operations API.
   */
  async saveChanges(templateId: string): Promise<SaveResult> {
    if (!this.hasUnsavedChanges()) {
      return { success: true, updatedLines: [] };
    }

    this.#setLoading(true);

    try {
      // Use computed operations for consistency
      const operations = this.pendingOperations();
      const response = await firstValueFrom(
        this.#budgetTemplatesApi.bulkOperationsTemplateLines$(
          templateId,
          operations,
        ),
      );

      const updatedLines = [...response.data.created, ...response.data.updated];
      this.#updateStateAfterSave(response.data);

      return { success: true, updatedLines };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Une erreur est survenue lors de la sauvegarde';

      this.#setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      this.#setLoading(false);
    }
  }

  /**
   * Clear the current error state.
   */
  clearError(): void {
    this.#clearError();
  }

  // Private helper methods for state management
  #generateTempId(): string {
    return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  #createEditableTransaction(
    data: TransactionFormData,
    originalLine?: TemplateLine,
  ): EditableTransaction {
    return {
      id: originalLine?.id ?? this.#generateTempId(),
      formData: { ...data },
      isNew: !originalLine,
      isDeleted: false,
      originalLine,
    };
  }

  #updateTransactionById(
    id: string,
    updater: (transaction: EditableTransaction) => EditableTransaction | null,
  ): boolean {
    const found = this.#findTransactionById(id);

    if (!found) return false;

    const updated = updater(found.transaction);

    if (updated === null) {
      // Remove transaction entirely
      this.#transactions.update((transactions) =>
        transactions.filter((_, i) => i !== found.index),
      );
    } else {
      // Update transaction
      this.#transactions.update((transactions) =>
        transactions.map((t, i) => (i === found.index ? updated : t)),
      );
    }

    return true;
  }

  #computeHasChanges(): boolean {
    const transactions = this.#transactions();

    return transactions.some(
      (t) =>
        // New transaction (not deleted)
        (t.isNew && !t.isDeleted) ||
        // Deleted existing transaction
        (t.isDeleted && !t.isNew) ||
        // Modified existing transaction
        (!t.isNew &&
          !t.isDeleted &&
          t.originalLine &&
          this.#isTransactionModified(t)),
    );
  }

  #isTransactionModified(transaction: EditableTransaction): boolean {
    const { originalLine, formData } = transaction;
    if (!originalLine) return false;

    return (
      originalLine.name !== formData.description ||
      originalLine.amount !== formData.amount ||
      originalLine.kind !== formData.type
    );
  }

  #computeIsValid(): boolean {
    return this.activeTransactions().every((t) => this.#isTransactionValid(t));
  }

  #isTransactionValid(transaction: EditableTransaction): boolean {
    return (
      transaction.formData.description.trim().length > 0 &&
      transaction.formData.amount >= 0
    );
  }

  // Helper for O(1) transaction lookup
  #findTransactionById(
    id: string,
  ): { transaction: EditableTransaction; index: number } | null {
    const transactions = this.#transactions();
    const index = transactions.findIndex((t) => t.id === id);
    return index !== -1 ? { transaction: transactions[index], index } : null;
  }

  #setLoading(loading: boolean): void {
    this.#isLoading.set(loading);
    if (loading) this.#clearError();
  }

  #setError(error: string): void {
    this.#error.set(error);
  }

  #clearError(): void {
    this.#error.set(null);
  }

  #generateBulkOperations(
    transactions: EditableTransaction[],
  ): TemplateLinesBulkOperations {
    return {
      create: transactions
        .filter((t) => t.isNew && !t.isDeleted)
        .map((t) => this.#mapToCreateData(t)),

      update: transactions
        .filter(
          (t) =>
            !t.isNew &&
            !t.isDeleted &&
            t.originalLine &&
            this.#isTransactionModified(t),
        )
        .map((t) => this.#mapToUpdateData(t)),

      delete: transactions
        .filter((t) => t.isDeleted && !t.isNew)
        .map((t) => t.id),
    };
  }

  #mapToCreateData(
    transaction: EditableTransaction,
  ): TemplateLineCreateWithoutTemplateId {
    return {
      name: transaction.formData.description,
      amount: transaction.formData.amount,
      kind: transaction.formData.type,
      recurrence: 'fixed',
      description: '',
    };
  }

  #mapToUpdateData(transaction: EditableTransaction): TemplateLineUpdateWithId {
    const { originalLine, formData } = transaction;
    return {
      id: transaction.id,
      name: formData.description,
      amount: formData.amount,
      kind: formData.type,
      recurrence: originalLine!.recurrence,
      description: originalLine!.description,
    };
  }

  #updateStateAfterSave(saveResponse: {
    created: TemplateLine[];
    updated: TemplateLine[];
    deleted: string[];
  }): void {
    const currentTransactions = this.#transactions();
    let createdIndex = 0;

    const updatedTransactions = currentTransactions
      .filter((t) => !(t.isDeleted && !t.isNew)) // Remove deleted existing transactions
      .map((transaction) => {
        if (transaction.isNew && !transaction.isDeleted) {
          // Convert new transactions to existing ones with real IDs
          const createdLine = saveResponse.created[createdIndex++];
          return createdLine
            ? this.#convertToExistingTransaction(transaction, createdLine)
            : transaction;
        }

        if (!transaction.isNew && !transaction.isDeleted) {
          // Update existing transactions with fresh data from server
          const updatedLine = saveResponse.updated.find(
            (line) => line.id === transaction.id,
          );
          return this.#syncWithServerData(transaction, updatedLine);
        }

        return transaction;
      });

    this.#transactions.set(updatedTransactions);
  }

  #convertToExistingTransaction(
    transaction: EditableTransaction,
    createdLine: TemplateLine,
  ): EditableTransaction {
    return {
      id: createdLine.id,
      formData: {
        description: createdLine.name,
        amount: createdLine.amount,
        type: createdLine.kind,
      },
      isNew: false,
      isDeleted: false,
      originalLine: createdLine,
    };
  }

  #syncWithServerData(
    transaction: EditableTransaction,
    updatedLine?: TemplateLine,
  ): EditableTransaction {
    const originalLine = updatedLine || transaction.originalLine;

    return {
      ...transaction,
      formData: originalLine
        ? {
            description: originalLine.name,
            amount: originalLine.amount,
            type: originalLine.kind,
          }
        : transaction.formData,
      originalLine,
    };
  }
}
