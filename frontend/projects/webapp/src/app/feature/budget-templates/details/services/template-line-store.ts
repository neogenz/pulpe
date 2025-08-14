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
import type { EditableLine, SaveResult } from './template-line-state';

/**
 * TemplateLineStore - Simplified store for managing template line editing
 *
 * This store provides a simplified API for managing template line editing:
 * - Direct state management with public signals
 * - CRUD operations with array index-based identification
 * - Bulk operations for efficient API calls
 * - Minimal complexity while preserving all essential functionality
 */
@Injectable()
export class TemplateLineStore {
  readonly #budgetTemplatesApi = inject(BudgetTemplatesApi);

  // Direct public state signals
  readonly lines = signal<EditableLine[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  // Computed properties for component consumption
  readonly activeLines = computed(() =>
    this.lines().filter((_, index) => !this.#isLineDeleted(index)),
  );

  readonly hasUnsavedChanges = computed(() => {
    const currentLines = this.lines();
    return currentLines.some(
      (line) =>
        line.isModified ||
        !line.originalLine ||
        this.#isLineDeleted(currentLines.indexOf(line)),
    );
  });

  readonly canRemoveTransaction = computed(() => this.activeLines().length > 1);
  readonly isValid = computed(() =>
    this.activeLines().every((line) => this.#isLineValid(line)),
  );

  // Track deleted line indices
  readonly #deletedIndices = signal<Set<number>>(new Set());

  /**
   * Initialize the editor with template lines and form data
   */
  initialize(
    templateLines: TemplateLine[],
    formData: TransactionFormData[],
  ): void {
    const editableLines = formData.map((data, index) => {
      const originalLine = templateLines[index];
      return this.#createEditableLine(data, originalLine);
    });

    this.lines.set(editableLines);
    this.#deletedIndices.set(new Set());
    this.error.set(null);
  }

  /**
   * Add a new line to the list
   */
  addTransaction(data: TransactionFormData): string {
    const newLine = this.#createEditableLine(data);
    this.lines.update((lines) => [...lines, newLine]);
    return this.lines().length - 1 + ''; // Return index as string ID
  }

  /**
   * Update an existing line by index
   */
  updateTransaction(
    id: string,
    updates: Partial<TransactionFormData>,
  ): boolean {
    const index = parseInt(id);
    if (
      isNaN(index) ||
      index < 0 ||
      index >= this.lines().length ||
      this.#isLineDeleted(index)
    ) {
      return false;
    }

    this.lines.update((lines) =>
      lines.map((line, i) =>
        i === index
          ? {
              ...line,
              formData: { ...line.formData, ...updates },
              isModified: true,
            }
          : line,
      ),
    );
    return true;
  }

  /**
   * Remove a line by index
   */
  removeTransaction(id: string): boolean {
    if (!this.canRemoveTransaction()) {
      return false;
    }

    const index = parseInt(id);
    if (isNaN(index) || index < 0 || index >= this.lines().length) {
      return false;
    }

    const line = this.lines()[index];

    if (!line.originalLine) {
      // New line - remove entirely
      this.lines.update((lines) => lines.filter((_, i) => i !== index));
      // Update deleted indices after removal
      const deletedSet = new Set(this.#deletedIndices());
      const updatedDeleted = new Set<number>();
      deletedSet.forEach((deletedIndex) => {
        if (deletedIndex > index) {
          updatedDeleted.add(deletedIndex - 1);
        } else if (deletedIndex !== index) {
          updatedDeleted.add(deletedIndex);
        }
      });
      this.#deletedIndices.set(updatedDeleted);
    } else {
      // Existing line - mark as deleted
      this.#deletedIndices.update((deleted) => new Set([...deleted, index]));
    }

    return true;
  }

  /**
   * Save all changes via bulk operations API
   */
  async saveChanges(templateId: string): Promise<SaveResult> {
    if (!this.hasUnsavedChanges()) {
      return { success: true, updatedLines: [], deletedIds: [] };
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const operations = this.#generateBulkOperations();
      const response = await firstValueFrom(
        this.#budgetTemplatesApi.bulkOperationsTemplateLines$(
          templateId,
          operations,
        ),
      );

      this.#updateStateAfterSave(response.data);

      const updatedLines = [...response.data.created, ...response.data.updated];
      return {
        success: true,
        updatedLines,
        deletedIds: response.data.deleted,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Une erreur est survenue lors de la sauvegarde';

      this.error.set(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      this.isLoading.set(false);
    }
  }

  // Private helper methods

  #createEditableLine(
    data: TransactionFormData,
    originalLine?: TemplateLine,
  ): EditableLine {
    return {
      formData: { ...data },
      isModified: !originalLine,
      originalLine,
    };
  }

  #isLineDeleted(index: number): boolean {
    return this.#deletedIndices().has(index);
  }

  #isLineValid(line: EditableLine): boolean {
    return (
      line.formData.description.trim().length > 0 && line.formData.amount >= 0
    );
  }

  #generateBulkOperations(): TemplateLinesBulkOperations {
    const currentLines = this.lines();
    const deletedSet = this.#deletedIndices();

    return {
      create: currentLines
        .filter((line, index) => !line.originalLine && !deletedSet.has(index))
        .map((line) => this.#mapToCreateData(line)),

      update: currentLines
        .filter(
          (line, index) =>
            line.originalLine &&
            !deletedSet.has(index) &&
            line.isModified &&
            this.#isLineModified(line),
        )
        .map((line) => this.#mapToUpdateData(line)),

      delete: currentLines
        .filter((line, index) => line.originalLine && deletedSet.has(index))
        .map((line) => line.originalLine!.id),
    };
  }

  #isLineModified(line: EditableLine): boolean {
    const { originalLine, formData } = line;
    if (!originalLine) return false;

    return (
      originalLine.name !== formData.description ||
      originalLine.amount !== formData.amount ||
      originalLine.kind !== formData.type
    );
  }

  #mapToCreateData(line: EditableLine): TemplateLineCreateWithoutTemplateId {
    return {
      name: line.formData.description,
      amount: line.formData.amount,
      kind: line.formData.type,
      recurrence: 'fixed',
      description: '',
    };
  }

  #mapToUpdateData(line: EditableLine): TemplateLineUpdateWithId {
    const { originalLine, formData } = line;
    return {
      id: originalLine!.id,
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
    const currentLines = this.lines();
    let createdIndex = 0;

    // Remove deleted lines and update existing lines
    const updatedLines = currentLines
      .filter((_, index) => !this.#deletedIndices().has(index))
      .map((line) => {
        if (!line.originalLine) {
          // Convert new line to existing with real template line data
          const createdLine = saveResponse.created[createdIndex++];
          return createdLine ? this.#convertToExistingLine(createdLine) : line;
        }

        if (line.isModified) {
          // Update existing line with fresh data from server
          const updatedLine = saveResponse.updated.find(
            (l) => l.id === line.originalLine!.id,
          );
          return this.#syncWithServerData(line, updatedLine);
        }

        return line;
      });

    this.lines.set(updatedLines);
    this.#deletedIndices.set(new Set());
  }

  #convertToExistingLine(createdLine: TemplateLine): EditableLine {
    return {
      formData: {
        description: createdLine.name,
        amount: createdLine.amount,
        type: createdLine.kind,
      },
      isModified: false,
      originalLine: createdLine,
    };
  }

  #syncWithServerData(
    line: EditableLine,
    updatedLine?: TemplateLine,
  ): EditableLine {
    const originalLine = updatedLine || line.originalLine;

    return {
      ...line,
      formData: originalLine
        ? {
            description: originalLine.name,
            amount: originalLine.amount,
            type: originalLine.kind,
          }
        : line.formData,
      isModified: false,
      originalLine,
    };
  }
}
