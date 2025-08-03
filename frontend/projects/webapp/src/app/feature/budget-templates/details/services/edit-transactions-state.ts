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
} from './edit-transactions.types';

/**
 * State management service for editing template transactions.
 * Follows the established patterns from BudgetDetailsState and OnboardingStore.
 */
@Injectable()
export class EditTransactionsState {
  readonly #budgetTemplatesApi = inject(BudgetTemplatesApi);

  // Private signals for internal state
  readonly #transactions = signal<EditableTransaction[]>([]);
  readonly #isLoading = signal(false);
  readonly #error = signal<string | null>(null);

  // Public readonly signals
  readonly transactions = this.#transactions.asReadonly();
  readonly isLoading = this.#isLoading.asReadonly();
  readonly error = this.#error.asReadonly();

  // Computed signals for derived state
  readonly transactionCount = computed(
    () => this.transactions().filter((t) => !t.isDeleted).length,
  );

  readonly hasUnsavedChanges = computed(() => this.#hasChanges());

  readonly canRemoveTransaction = computed(() => this.transactionCount() > 1);

  /**
   * Initialize the state with template lines and form data.
   * This should be called when the dialog opens.
   */
  initialize(
    templateLines: TemplateLine[],
    formData: TransactionFormData[],
  ): void {
    const editableTransactions: EditableTransaction[] = [];

    // Create editable transactions from the form data
    const maxLength = Math.max(templateLines.length, formData.length);

    for (let i = 0; i < maxLength; i++) {
      const originalLine = templateLines[i];
      const data = formData[i];

      if (data) {
        editableTransactions.push({
          id: originalLine?.id ?? this.#generateTempId(),
          formData: data,
          isNew: !originalLine,
          isDeleted: false,
          originalLine,
        });
      }
    }

    this.#transactions.set(editableTransactions);
    this.#error.set(null);
  }

  /**
   * Add a new transaction to the list.
   * Returns the generated ID for the new transaction.
   */
  addTransaction(data: TransactionFormData): string {
    const tempId = this.#generateTempId();

    const newTransaction: EditableTransaction = {
      id: tempId,
      formData: { ...data },
      isNew: true,
      isDeleted: false,
    };

    this.#transactions.update((transactions) => [
      ...transactions,
      newTransaction,
    ]);

    return tempId;
  }

  /**
   * Update an existing transaction by ID.
   * Returns true if the transaction was found and updated, false otherwise.
   */
  updateTransaction(
    id: string,
    updates: Partial<TransactionFormData>,
  ): boolean {
    const transactions = this.#transactions();
    const index = transactions.findIndex((t) => t.id === id && !t.isDeleted);

    if (index === -1) {
      return false;
    }

    const updatedTransactions = [...transactions];
    updatedTransactions[index] = {
      ...updatedTransactions[index],
      formData: {
        ...updatedTransactions[index].formData,
        ...updates,
      },
    };

    this.#transactions.set(updatedTransactions);

    return true;
  }

  /**
   * Remove a transaction by ID.
   * For new transactions, removes them entirely. For existing transactions, marks as deleted.
   * Returns true if the transaction was removed, false if it can't be removed.
   */
  removeTransaction(id: string): boolean {
    const transactions = this.#transactions();
    const activeCount = transactions.filter((t) => !t.isDeleted).length;

    // Prevent removing the last transaction
    if (activeCount <= 1) {
      return false;
    }

    const index = transactions.findIndex((t) => t.id === id);
    if (index === -1) {
      return false;
    }

    const transaction = transactions[index];

    if (transaction.isNew) {
      // Remove new transactions entirely
      const updatedTransactions = [...transactions];
      updatedTransactions.splice(index, 1);
      this.#transactions.set(updatedTransactions);
    } else {
      // Mark existing transactions as deleted
      const updatedTransactions = [...transactions];
      updatedTransactions[index] = {
        ...transaction,
        isDeleted: true,
      };
      this.#transactions.set(updatedTransactions);
    }

    return true;
  }

  /**
   * Save all changes by calling the bulk operations API.
   * Returns a result object indicating success/failure and any updated lines.
   */
  async saveChanges(templateId: string): Promise<SaveResult> {
    const operations = this.#generateBulkOperations();

    // Early return if no changes
    if (
      operations.create.length === 0 &&
      operations.update.length === 0 &&
      operations.delete.length === 0
    ) {
      return { success: true, updatedLines: [] };
    }

    this.#isLoading.set(true);
    this.#error.set(null);

    try {
      const response = await firstValueFrom(
        this.#budgetTemplatesApi.bulkOperationsTemplateLines$(
          templateId,
          operations,
        ),
      );

      // Combine created and updated lines
      const updatedLines = [...response.data.created, ...response.data.updated];

      // Update the state to reflect the successful save
      this.#updateStateAfterSave(response.data);

      return {
        success: true,
        updatedLines,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Une erreur est survenue lors de la sauvegarde';

      this.#error.set(errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      this.#isLoading.set(false);
    }
  }

  /**
   * Clear the current error state.
   */
  clearError(): void {
    this.#error.set(null);
  }

  /**
   * Generate a unique temporary ID for new transactions.
   */
  #generateTempId(): string {
    return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if there are any changes that need to be saved.
   */
  #hasChanges(): boolean {
    const transactions = this.#transactions();

    // Check for new transactions
    if (transactions.some((t) => t.isNew && !t.isDeleted)) {
      return true;
    }

    // Check for deleted transactions
    if (transactions.some((t) => t.isDeleted && !t.isNew)) {
      return true;
    }

    // Check for modified existing transactions
    return transactions.some((t) => {
      if (t.isNew || t.isDeleted || !t.originalLine) {
        return false;
      }

      const original = t.originalLine;
      const current = t.formData;

      return (
        original.name !== current.description ||
        original.amount !== current.amount ||
        original.kind !== current.type
      );
    });
  }

  /**
   * Generate bulk operations for the API based on current state.
   */
  #generateBulkOperations(): TemplateLinesBulkOperations {
    const transactions = this.#transactions();
    const operations: TemplateLinesBulkOperations = {
      create: [],
      update: [],
      delete: [],
    };

    for (const transaction of transactions) {
      if (transaction.isDeleted && !transaction.isNew) {
        // Delete existing transaction
        operations.delete.push(transaction.id);
      } else if (transaction.isNew && !transaction.isDeleted) {
        // Create new transaction
        const createData: TemplateLineCreateWithoutTemplateId = {
          name: transaction.formData.description,
          amount: transaction.formData.amount,
          kind: transaction.formData.type,
          recurrence: 'fixed',
          description: '',
        };
        operations.create.push(createData);
      } else if (
        !transaction.isNew &&
        !transaction.isDeleted &&
        transaction.originalLine
      ) {
        // Update existing transaction (only if changed)
        const original = transaction.originalLine;
        const current = transaction.formData;

        if (
          original.name !== current.description ||
          original.amount !== current.amount ||
          original.kind !== current.type
        ) {
          const updateData: TemplateLineUpdateWithId = {
            id: transaction.id,
            name: current.description,
            amount: current.amount,
            kind: current.type,
            recurrence: original.recurrence,
            description: original.description,
          };
          operations.update.push(updateData);
        }
      }
    }

    return operations;
  }

  /**
   * Update the internal state after a successful save to reflect that changes are now persisted.
   */
  #updateStateAfterSave(saveResponse: {
    created: TemplateLine[];
    updated: TemplateLine[];
    deleted: string[];
  }): void {
    const currentTransactions = this.#transactions();
    const updatedTransactions: EditableTransaction[] = [];

    let createdIndex = 0;

    for (const transaction of currentTransactions) {
      if (transaction.isDeleted && !transaction.isNew) {
        // Remove deleted transactions entirely
        continue;
      } else if (transaction.isNew && !transaction.isDeleted) {
        // Convert new transactions to existing ones with real IDs
        const createdLine = saveResponse.created[createdIndex++];
        if (createdLine) {
          updatedTransactions.push({
            id: createdLine.id,
            formData: {
              description: createdLine.name,
              amount: createdLine.amount,
              type: createdLine.kind,
            },
            isNew: false,
            isDeleted: false,
            originalLine: createdLine,
          });
        }
      } else if (!transaction.isNew && !transaction.isDeleted) {
        // Keep existing non-deleted transactions with updated original line data
        const updatedLine = saveResponse.updated.find(
          (line) => line.id === transaction.id,
        );
        const originalLine = updatedLine || transaction.originalLine;

        updatedTransactions.push({
          ...transaction,
          formData: originalLine
            ? {
                description: originalLine.name,
                amount: originalLine.amount,
                type: originalLine.kind,
              }
            : transaction.formData,
          originalLine,
        });
      }
    }

    this.#transactions.set(updatedTransactions);
  }

  /**
   * Set error state (used internally for testing)
   */
  private setError(error: string): void {
    this.#error.set(error);
  }
}
