import type { ResourceRef } from '@angular/core';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '@core/logging/logger';
import { TransactionApi } from '@core/transaction/transaction-api';
import {
  type BudgetLine,
  type BudgetLineCreate,
  type BudgetLineUpdate,
  type Transaction,
  type TransactionCreate,
} from 'pulpe-shared';

import type { BudgetDetailsViewModel } from '../models/budget-details-view-model';
import { BudgetLineApi } from '../budget-line-api/budget-line-api';
import {
  addBudgetLine,
  addTransaction,
  removeBudgetLine,
  removeTransaction,
  replaceBudgetLine,
  replaceTransaction,
  updateBudgetLine,
} from '../store/budget-details-updaters';
import { runOptimisticMutation } from '@core/mutations/optimistic-mutation';

export interface MutationContext {
  readonly resource: ResourceRef<BudgetDetailsViewModel>;
  readonly onCacheInvalidated: () => void;
  readonly onError: (message: string) => void;
}

@Injectable()
export class BudgetDetailsMutationsService {
  readonly #budgetLineApi = inject(BudgetLineApi);
  readonly #transactionApi = inject(TransactionApi);
  readonly #logger = inject(Logger);

  async createBudgetLine(
    budgetLine: BudgetLineCreate,
    ctx: MutationContext,
  ): Promise<void> {
    const newId = `temp-${uuidv4()}`;
    const tempLine: BudgetLine = {
      ...budgetLine,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      templateLineId: null,
      savingsGoalId: null,
      checkedAt: budgetLine.checkedAt ?? null,
    };

    return runOptimisticMutation({
      resource: ctx.resource,
      optimisticUpdate: (d) => addBudgetLine(d, tempLine),
      apiCall: () =>
        firstValueFrom(this.#budgetLineApi.createBudgetLine$(budgetLine)),
      reconcile: (d, response) => replaceBudgetLine(d, newId, response.data),
      onSuccess: () => ctx.onCacheInvalidated(),
      onError: (error) => {
        ctx.onError("Erreur lors de l'ajout de la prévision");
        this.#logger.error("Erreur lors de l'ajout de la prévision", error);
      },
    });
  }

  async updateBudgetLine(
    data: BudgetLineUpdate,
    ctx: MutationContext,
  ): Promise<void> {
    return runOptimisticMutation({
      resource: ctx.resource,
      optimisticUpdate: (d) => updateBudgetLine(d, data),
      apiCall: () =>
        firstValueFrom(this.#budgetLineApi.updateBudgetLine$(data.id, data)),
      onSuccess: () => ctx.onCacheInvalidated(),
      onError: (error) => {
        ctx.onError('Erreur lors de la modification de la prévision');
        this.#logger.error(
          'Erreur lors de la modification de la prévision',
          error,
        );
      },
    });
  }

  async deleteBudgetLine(id: string, ctx: MutationContext): Promise<void> {
    return runOptimisticMutation({
      resource: ctx.resource,
      optimisticUpdate: (d) => removeBudgetLine(d, id),
      apiCall: () => firstValueFrom(this.#budgetLineApi.deleteBudgetLine$(id)),
      onSuccess: () => ctx.onCacheInvalidated(),
      onError: (error) => {
        ctx.onError('Erreur lors de la suppression de la prévision');
        this.#logger.error(
          'Erreur lors de la suppression de la prévision',
          error,
        );
      },
    });
  }

  async deleteTransaction(id: string, ctx: MutationContext): Promise<void> {
    return runOptimisticMutation({
      resource: ctx.resource,
      optimisticUpdate: (d) => removeTransaction(d, id),
      apiCall: () => firstValueFrom(this.#transactionApi.remove$(id)),
      onSuccess: () => ctx.onCacheInvalidated(),
      onError: (error) => {
        ctx.onError('Erreur lors de la suppression de la transaction');
        this.#logger.error(
          'Erreur lors de la suppression de la transaction',
          error,
        );
      },
    });
  }

  async createAllocatedTransaction(
    transactionData: TransactionCreate,
    ctx: MutationContext,
  ): Promise<void> {
    const newId = `temp-${uuidv4()}`;
    const details = ctx.resource.value();
    if (!details) return;

    const parentBudgetLine = details.budgetLines.find(
      (line) => line.id === transactionData.budgetLineId,
    );
    const inheritedCheckedAt = parentBudgetLine?.checkedAt
      ? new Date(parentBudgetLine.checkedAt).toISOString()
      : null;

    const tempTransaction: Transaction = {
      id: newId,
      budgetId: transactionData.budgetId,
      budgetLineId: transactionData.budgetLineId ?? null,
      name: transactionData.name,
      amount: transactionData.amount,
      kind: transactionData.kind,
      transactionDate:
        transactionData.transactionDate ?? new Date().toISOString(),
      category: transactionData.category ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      checkedAt: inheritedCheckedAt,
    };

    return runOptimisticMutation({
      resource: ctx.resource,
      optimisticUpdate: (d) => addTransaction(d, tempTransaction),
      apiCall: () =>
        firstValueFrom(
          this.#transactionApi.create$({
            ...transactionData,
            checkedAt: inheritedCheckedAt,
          }),
        ),
      reconcile: (d, response) => replaceTransaction(d, newId, response.data),
      onSuccess: () => ctx.onCacheInvalidated(),
      onError: (error) => {
        ctx.onError("Erreur lors de l'ajout de la transaction");
        this.#logger.error("Erreur lors de l'ajout de la transaction", error);
      },
    });
  }

  async resetBudgetLineFromTemplate(
    id: string,
    ctx: MutationContext,
  ): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.#budgetLineApi.resetFromTemplate$(id),
      );

      ctx.resource.update((d) =>
        d ? replaceBudgetLine(d, id, response.data) : d,
      );

      ctx.onCacheInvalidated();
    } catch (error) {
      ctx.resource.reload();
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Erreur lors de la réinitialisation de la prévision';
      ctx.onError(errorMessage);
      this.#logger.error('Error resetting budget line from template', error);
      throw error;
    }
  }
}
