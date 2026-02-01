import type { ResourceRef } from '@angular/core';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TransactionApi } from '@core/transaction/transaction-api';

import type { BudgetDetailsViewModel } from '../models/budget-details-view-model';
import { BudgetLineApi } from '../budget-line-api/budget-line-api';
import {
  calculateBudgetLineToggle,
  calculateTransactionToggle,
} from '../store/budget-details-check.utils';
import {
  applyToggleResult,
  replaceBudgetLine,
  replaceTransaction,
} from '../store/budget-details-updaters';

export interface ToggleContext {
  readonly resource: ResourceRef<BudgetDetailsViewModel>;
  readonly onSuccess: () => void;
  readonly onError: (message: string, error: unknown) => void;
}

@Injectable()
export class BudgetDetailsToggleService {
  readonly #budgetLineApi = inject(BudgetLineApi);
  readonly #transactionApi = inject(TransactionApi);

  // Toggle queue serializes rapid API calls to prevent race conditions.
  // Tests confirm this is needed (toggle serialization tests).
  #toggleQueue = Promise.resolve();

  #enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#toggleQueue.then(() => operation());
    this.#toggleQueue = result.catch(() => undefined).then(() => undefined);
    return result;
  }

  async toggleCheck(id: string, context: ToggleContext): Promise<void> {
    const details = context.resource.value();
    if (!details) return;

    const result = calculateBudgetLineToggle(id, {
      budgetLines: details.budgetLines,
      transactions: details.transactions ?? [],
    });
    if (!result) return;

    context.resource.update((d) => (d ? applyToggleResult(d, result) : d));

    try {
      const response = await this.#enqueue(() =>
        firstValueFrom(this.#budgetLineApi.toggleCheck$(id)),
      );

      for (const tx of result.transactionsToToggle) {
        await this.#enqueue(() =>
          firstValueFrom(this.#transactionApi.toggleCheck$(tx.id)),
        );
      }

      context.resource.update((d) =>
        d ? replaceBudgetLine(d, id, response.data) : d,
      );

      context.onSuccess();
    } catch (error) {
      context.resource.reload();
      context.onError(
        'Erreur lors du basculement du statut de la prévision',
        error,
      );
    }
  }

  async toggleTransactionCheck(
    id: string,
    context: ToggleContext,
  ): Promise<void> {
    const details = context.resource.value();
    if (!details) return;

    const result = calculateTransactionToggle(id, {
      budgetLines: details.budgetLines,
      transactions: details.transactions ?? [],
    });
    if (!result) return;

    context.resource.update((d) => (d ? applyToggleResult(d, result) : d));

    try {
      const response = await this.#enqueue(() =>
        firstValueFrom(this.#transactionApi.toggleCheck$(id)),
      );

      if (result.shouldToggleBudgetLine && result.budgetLineId) {
        await this.#enqueue(() =>
          firstValueFrom(
            this.#budgetLineApi.toggleCheck$(result.budgetLineId!),
          ),
        );
      }

      context.resource.update((d) =>
        d ? replaceTransaction(d, id, response.data) : d,
      );

      context.onSuccess();
    } catch (error) {
      context.resource.reload();
      context.onError(
        'Erreur lors du basculement du statut de la transaction',
        error,
      );
    }
  }
}
