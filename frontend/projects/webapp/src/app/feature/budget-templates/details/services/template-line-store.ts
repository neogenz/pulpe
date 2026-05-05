import { Injectable, inject } from '@angular/core';
import { cachedMutation } from 'ngx-ziflux';
import { BudgetApi } from '@core/budget/budget-api';
import { BudgetTemplatesApi } from '@core/budget-template/budget-templates-api';
import { Logger } from '@core/logging/logger';
import {
  type TemplateLine,
  type TemplateLineCreateWithoutTemplateId,
  type TemplateLineUpdateWithId,
  type TemplateLinesBulkOperationsResponse,
  type TemplateLinesPropagationSummary,
  type TransactionKind,
  type SupportedCurrency,
} from 'pulpe-shared';
import { v4 as uuidv4 } from 'uuid';
import { TemplateDetailsStore } from './template-details-store';

const TEMP_ID_PREFIX = 'temp-';

function generateTempId(): string {
  return `${TEMP_ID_PREFIX}${uuidv4()}`;
}

export interface TemplateLineFormInput {
  name: string;
  amount: number;
  kind: TransactionKind;
  originalAmount?: number;
  originalCurrency?: SupportedCurrency;
  targetCurrency?: SupportedCurrency;
  exchangeRate?: number;
}

type BulkMutationResult = TemplateLinesBulkOperationsResponse;

@Injectable()
export class TemplateLineStore {
  readonly #budgetApi = inject(BudgetApi);
  readonly #budgetTemplatesApi = inject(BudgetTemplatesApi);
  readonly #templateDetailsStore = inject(TemplateDetailsStore);
  readonly #logger = inject(Logger);

  readonly #createMutation = cachedMutation<
    {
      templateId: string;
      tempId: string;
      payload: TemplateLineCreateWithoutTemplateId;
      propagateToBudgets: boolean;
    },
    BulkMutationResult,
    void
  >({
    cache: this.#budgetTemplatesApi.cache,
    invalidateKeys: () => [['templates']],
    mutationFn: ({ templateId, payload, propagateToBudgets }) =>
      this.#budgetTemplatesApi.bulkOperationsTemplateLines$(templateId, {
        create: [payload],
        update: [],
        delete: [],
        propagateToBudgets,
      }),
    onMutate: ({ tempId, payload }) => {
      const optimisticLine = this.#buildOptimisticLine(tempId, payload);
      this.#patchLines([
        ...this.#templateDetailsStore.templateLines(),
        optimisticLine,
      ]);
    },
    onSuccess: (response, { tempId }) => {
      const created = response.data.created[0];
      if (!created) return;
      const lines = this.#templateDetailsStore
        .templateLines()
        .map((line) => (line.id === tempId ? created : line));
      this.#patchLines(lines);
      this.#invalidateBudgetsIfPropagated(response.data.propagation);
    },
    onError: (err) => {
      this.#logger.error('Error creating template line:', err);
      this.#templateDetailsStore.reloadTemplateDetails();
    },
  });

  readonly #updateMutation = cachedMutation<
    {
      templateId: string;
      payload: TemplateLineUpdateWithId;
      propagateToBudgets: boolean;
    },
    BulkMutationResult,
    void
  >({
    cache: this.#budgetTemplatesApi.cache,
    invalidateKeys: () => [['templates']],
    mutationFn: ({ templateId, payload, propagateToBudgets }) =>
      this.#budgetTemplatesApi.bulkOperationsTemplateLines$(templateId, {
        create: [],
        update: [payload],
        delete: [],
        propagateToBudgets,
      }),
    onMutate: ({ payload }) => {
      const patched = this.#templateDetailsStore.templateLines().map((line) =>
        line.id === payload.id
          ? {
              ...line,
              ...payload,
              updatedAt: new Date().toISOString(),
            }
          : line,
      );
      this.#patchLines(patched);
    },
    onSuccess: (response, { payload }) => {
      const updated = response.data.updated.find(
        (line) => line.id === payload.id,
      );
      if (!updated) return;
      const lines = this.#templateDetailsStore
        .templateLines()
        .map((line) => (line.id === updated.id ? updated : line));
      this.#patchLines(lines);
      this.#invalidateBudgetsIfPropagated(response.data.propagation);
    },
    onError: (err) => {
      this.#logger.error('Error updating template line:', err);
      this.#templateDetailsStore.reloadTemplateDetails();
    },
  });

  readonly #deleteMutation = cachedMutation<
    {
      templateId: string;
      lineId: string;
      propagateToBudgets: boolean;
    },
    BulkMutationResult,
    void
  >({
    cache: this.#budgetTemplatesApi.cache,
    invalidateKeys: () => [['templates']],
    mutationFn: ({ templateId, lineId, propagateToBudgets }) =>
      this.#budgetTemplatesApi.bulkOperationsTemplateLines$(templateId, {
        create: [],
        update: [],
        delete: [lineId],
        propagateToBudgets,
      }),
    onMutate: ({ lineId }) => {
      this.#patchLines(
        this.#templateDetailsStore
          .templateLines()
          .filter((line) => line.id !== lineId),
      );
    },
    onSuccess: (response) => {
      this.#invalidateBudgetsIfPropagated(response.data.propagation);
    },
    onError: (err) => {
      this.#logger.error('Error deleting template line:', err);
      this.#templateDetailsStore.reloadTemplateDetails();
    },
  });

  async createLine(
    templateId: string,
    input: TemplateLineFormInput,
    propagate: boolean,
  ): Promise<BulkMutationResult | undefined> {
    return this.#createMutation.mutate({
      templateId,
      tempId: generateTempId(),
      payload: this.#toCreatePayload(input),
      propagateToBudgets: propagate,
    });
  }

  async updateLine(
    templateId: string,
    lineId: string,
    input: TemplateLineFormInput,
    propagate: boolean,
  ): Promise<BulkMutationResult | undefined> {
    const payload: TemplateLineUpdateWithId = {
      id: lineId,
      name: input.name,
      amount: input.amount,
      kind: input.kind,
      ...this.#extractCurrencyFields(input),
    };

    return this.#updateMutation.mutate({
      templateId,
      payload,
      propagateToBudgets: propagate,
    });
  }

  async deleteLine(
    templateId: string,
    lineId: string,
    propagate: boolean,
  ): Promise<BulkMutationResult | undefined> {
    return this.#deleteMutation.mutate({
      templateId,
      lineId,
      propagateToBudgets: propagate,
    });
  }

  #invalidateBudgetsIfPropagated(
    propagation: TemplateLinesPropagationSummary | null,
  ): void {
    if (propagation?.mode === 'propagate') {
      this.#budgetApi.cache.invalidate(['budget']);
    }
  }

  #patchLines(lines: TemplateLine[]): void {
    const current = this.#templateDetailsStore.rawDetails();
    if (!current) return;
    this.#templateDetailsStore.setDetails({
      ...current,
      transactions: lines,
    });
  }

  #buildOptimisticLine(
    tempId: string,
    payload: TemplateLineCreateWithoutTemplateId,
  ): TemplateLine {
    const now = new Date().toISOString();
    const template = this.#templateDetailsStore.template();
    return {
      id: tempId,
      templateId: template?.id ?? '',
      name: payload.name,
      amount: payload.amount,
      kind: payload.kind,
      recurrence: payload.recurrence,
      description: payload.description,
      createdAt: now,
      updatedAt: now,
      originalAmount: payload.originalAmount ?? null,
      originalCurrency: payload.originalCurrency ?? null,
      targetCurrency: payload.targetCurrency ?? null,
      exchangeRate: payload.exchangeRate ?? null,
    };
  }

  #toCreatePayload(
    input: TemplateLineFormInput,
  ): TemplateLineCreateWithoutTemplateId {
    return {
      name: input.name,
      amount: input.amount,
      kind: input.kind,
      recurrence: 'fixed',
      description: '',
      ...this.#extractCurrencyFields(input),
    };
  }

  #extractCurrencyFields(
    input: TemplateLineFormInput,
  ): Partial<TemplateLineCreateWithoutTemplateId> {
    if (
      input.originalAmount == null ||
      input.originalCurrency == null ||
      input.targetCurrency == null ||
      input.exchangeRate == null
    ) {
      return {};
    }
    return {
      originalAmount: input.originalAmount,
      originalCurrency: input.originalCurrency,
      targetCurrency: input.targetCurrency,
      exchangeRate: input.exchangeRate,
    };
  }
}
