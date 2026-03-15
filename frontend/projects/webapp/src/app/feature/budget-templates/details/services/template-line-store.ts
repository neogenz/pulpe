import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { cachedMutation } from 'ngx-ziflux';
import { BudgetTemplatesApi } from '@core/budget-template/budget-templates-api';
import type { TransactionFormData } from '../../services/transaction-form';
import type {
  TemplateLine,
  TemplateLinesBulkOperations,
  TemplateLinesBulkOperationsResponse,
  TemplateLineCreateWithoutTemplateId,
  TemplateLineUpdateWithId,
} from 'pulpe-shared';
import type { EditableLine, SaveResult } from './template-line-state';

@Injectable()
export class TemplateLineStore {
  readonly #budgetTemplatesApi = inject(BudgetTemplatesApi);
  readonly #transloco = inject(TranslocoService);

  readonly #lines = signal<EditableLine[]>([]);
  readonly lines = this.#lines.asReadonly();
  readonly #isLoading = signal(false);
  readonly #error = signal<string | null>(null);

  readonly isLoading = computed(() => this.#isLoading());
  readonly hasValue = computed(() => this.lines().length > 0 && !this.#error());
  readonly error = computed(() => this.#error());

  readonly activeLines = computed(() =>
    this.lines().filter((line) => !this.#deletedIds().has(line.id)),
  );

  readonly hasUnsavedChanges = computed(() => {
    const currentLines = this.lines();
    const hasDeletedLines = this.#deletedIds().size > 0;
    const hasModifiedLines = currentLines.some(
      (line) => line.isModified || !line.originalLine,
    );
    return hasDeletedLines || hasModifiedLines;
  });

  readonly canRemoveTransaction = computed(() => this.activeLines().length > 1);
  readonly isValid = computed(() =>
    this.activeLines().every((line) => this.#isLineValid(line)),
  );

  readonly #deletedIds = signal<Set<string>>(new Set());

  readonly #bulkSaveMutation = cachedMutation<
    { templateId: string; operations: TemplateLinesBulkOperations },
    TemplateLinesBulkOperationsResponse,
    void
  >({
    cache: this.#budgetTemplatesApi.cache,
    mutationFn: ({ templateId, operations }) =>
      this.#budgetTemplatesApi.bulkOperationsTemplateLines$(
        templateId,
        operations,
      ),
    invalidateKeys: () => [['templates']],
  });

  getLineById(id: string): EditableLine | undefined {
    const line = this.lines().find((line) => line.id === id);
    return line && !this.#deletedIds().has(id) ? line : undefined;
  }

  initialize(
    templateLines: TemplateLine[],
    formData: TransactionFormData[],
  ): void {
    const editableLines = formData.map((data, index) => {
      const originalLine = templateLines[index];
      return this.#createEditableLine(data, originalLine);
    });

    this.#lines.set(editableLines);
    this.#deletedIds.set(new Set());
    this.#error.set(null);
  }

  addTransaction(data: TransactionFormData): string {
    const newLine = this.#createEditableLine(data);
    this.#lines.update((lines) => [...lines, newLine]);
    return newLine.id;
  }

  updateTransaction(
    id: string,
    updates: Partial<TransactionFormData>,
  ): boolean {
    if (!this.getLineById(id)) {
      return false;
    }

    this.#lines.update((lines) =>
      lines.map((line) =>
        line.id === id
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

  removeTransaction(id: string): boolean {
    if (!this.canRemoveTransaction()) {
      return false;
    }

    const line = this.lines().find((line) => line.id === id);
    if (!line || this.#deletedIds().has(id)) {
      return false;
    }

    if (!line.originalLine) {
      this.#lines.update((lines) => lines.filter((l) => l.id !== id));
    } else {
      this.#deletedIds.update((deleted) => new Set([...deleted, id]));
    }

    return true;
  }

  async saveChanges(
    templateId: string,
    propagateToBudgets: boolean,
  ): Promise<SaveResult> {
    if (!this.hasUnsavedChanges()) {
      return {
        success: true,
        updatedLines: [],
        deletedIds: [],
        propagation: null,
      };
    }

    this.#isLoading.set(true);
    this.#error.set(null);

    try {
      const operations = this.#generateBulkOperations(propagateToBudgets);
      const response = await this.#bulkSaveMutation.mutate({
        templateId,
        operations,
      });

      if (!response) {
        const mutationError = this.#bulkSaveMutation.error();
        const errorMessage =
          mutationError instanceof Error
            ? mutationError.message
            : this.#transloco.translate('template.saveError');
        this.#error.set(errorMessage);
        return { success: false, error: errorMessage };
      }

      this.#updateStateAfterSave(response.data);

      const updatedLines = [...response.data.created, ...response.data.updated];
      return {
        success: true,
        updatedLines,
        deletedIds: response.data.deleted,
        propagation: response.data.propagation,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : this.#transloco.translate('template.saveError');

      this.#error.set(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      this.#isLoading.set(false);
    }
  }

  #createEditableLine(
    data: TransactionFormData,
    originalLine?: TemplateLine,
  ): EditableLine {
    return {
      id: originalLine?.id ?? crypto.randomUUID(),
      formData: { ...data },
      isModified: !originalLine,
      originalLine,
    };
  }

  #isLineValid(line: EditableLine): boolean {
    return (
      line.formData.description.trim().length > 0 && line.formData.amount >= 0
    );
  }

  #generateBulkOperations(
    propagateToBudgets: boolean,
  ): TemplateLinesBulkOperations {
    const currentLines = this.lines();
    const deletedSet = this.#deletedIds();

    return {
      create: currentLines
        .filter((line) => !line.originalLine && !deletedSet.has(line.id))
        .map((line) => this.#mapToCreateData(line)),

      update: currentLines
        .filter(
          (line) =>
            line.originalLine &&
            !deletedSet.has(line.id) &&
            (line.isModified || this.#isLineModified(line)),
        )
        .map((line) => this.#mapToUpdateData(line)),

      delete: Array.from(deletedSet)
        .map((id) => currentLines.find((l) => l.id === id)?.originalLine?.id)
        .filter((id): id is string => id != null),
      propagateToBudgets,
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
    if (!originalLine) throw new Error('Cannot update line without original');
    return {
      id: originalLine.id,
      name: formData.description,
      amount: formData.amount,
      kind: formData.type,
      recurrence: originalLine.recurrence,
      description: originalLine.description,
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
      .filter((line) => !this.#deletedIds().has(line.id))
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

    this.#lines.set(updatedLines);
    this.#deletedIds.set(new Set());
  }

  #convertToExistingLine(createdLine: TemplateLine): EditableLine {
    return {
      id: createdLine.id,
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
      id: originalLine?.id ?? line.id,
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
