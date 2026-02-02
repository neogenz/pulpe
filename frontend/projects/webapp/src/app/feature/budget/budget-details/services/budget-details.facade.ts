import {
  computed,
  effect,
  inject,
  Injectable,
  type ResourceRef,
  signal,
} from '@angular/core';
import { BudgetInvalidationService } from '@core/budget/budget-invalidation.service';
import { Logger } from '@core/logging/logger';
import { STORAGE_KEYS } from '@core/storage/storage-keys';
import { StorageService } from '@core/storage/storage.service';
import {
  type BudgetLineCreate,
  type BudgetLineUpdate,
  type TransactionCreate,
} from 'pulpe-shared';

import type { BudgetDetailsViewModel } from '../models/budget-details-view-model';
import { BudgetDetailsStateService } from './budget-details-state.service';
import { BudgetNavigationService } from './budget-navigation.service';
import {
  BudgetDetailsMutationsService,
  type MutationContext,
} from './budget-details-mutations.service';
import {
  BudgetDetailsToggleService,
  type ToggleContext,
} from './budget-details-toggle.service';

@Injectable()
export class BudgetDetailsFacade {
  readonly #state = inject(BudgetDetailsStateService);
  readonly #navigation = inject(BudgetNavigationService);
  readonly #mutations = inject(BudgetDetailsMutationsService);
  readonly #toggles = inject(BudgetDetailsToggleService);
  readonly #invalidationService = inject(BudgetInvalidationService);
  readonly #storage = inject(StorageService);
  readonly #logger = inject(Logger);

  // ─── Filter State ──────────────────────────────────────────────

  readonly #isShowingOnlyUnchecked = signal<boolean>(
    this.#storage.get<boolean>(STORAGE_KEYS.BUDGET_SHOW_ONLY_UNCHECKED) ?? true,
  );
  readonly isShowingOnlyUnchecked = this.#isShowingOnlyUnchecked.asReadonly();

  constructor() {
    effect(() => {
      this.#storage.set(
        STORAGE_KEYS.BUDGET_SHOW_ONLY_UNCHECKED,
        this.#isShowingOnlyUnchecked(),
      );
    });
  }

  // ─── Delegated State Signals ───────────────────────────────────

  readonly budgetDetails = this.#state.budgetDetails;
  readonly isLoading = this.#state.isLoading;
  readonly isInitialLoading = this.#state.isInitialLoading;
  readonly hasValue = this.#state.hasValue;
  readonly error = this.#state.error;
  readonly displayBudgetLines = this.#state.displayBudgetLines;
  readonly realizedBalance = this.#state.realizedBalance;
  readonly realizedExpenses = this.#state.realizedExpenses;

  // ─── Delegated Navigation Signals ──────────────────────────────

  readonly previousBudgetId = this.#navigation.previousBudgetId;
  readonly nextBudgetId = this.#navigation.nextBudgetId;
  readonly hasPrevious = this.#navigation.hasPrevious;
  readonly hasNext = this.#navigation.hasNext;

  // ─── Filter Selectors ─────────────────────────────────────────

  readonly checkedItemsCount = computed(() => {
    if (!this.#state.resource.hasValue()) return 0;
    const details = this.#state.resource.value()!;
    const lines = this.displayBudgetLines();
    const transactions = details.transactions ?? [];
    return [...lines, ...transactions].filter((item) => item.checkedAt != null)
      .length;
  });

  readonly totalItemsCount = computed(() => {
    if (!this.#state.resource.hasValue()) return 0;
    const details = this.#state.resource.value()!;
    const lines = this.displayBudgetLines();
    const transactions = details.transactions ?? [];
    return lines.length + transactions.length;
  });

  readonly filteredBudgetLines = computed(() => {
    const lines = this.displayBudgetLines();
    if (!this.#isShowingOnlyUnchecked()) return lines;
    return lines.filter((line) => line.checkedAt === null);
  });

  readonly filteredTransactions = computed(() => {
    const details = this.budgetDetails();
    if (!details) return [];

    const transactions = details.transactions ?? [];
    if (!this.#isShowingOnlyUnchecked()) return transactions;

    const visibleBudgetLineIds = new Set(
      this.filteredBudgetLines().map((line) => line.id),
    );

    return transactions.filter((tx) => {
      if (tx.budgetLineId) return visibleBudgetLineIds.has(tx.budgetLineId);
      return tx.checkedAt === null;
    });
  });

  // ─── Shared Contexts ──────────────────────────────────────────

  get #mutationContext(): MutationContext {
    return {
      resource: this.#state.resource as ResourceRef<BudgetDetailsViewModel>,
      onCacheInvalidated: () => this.#invalidateCache(),
      onError: (msg) => this.#state.setErrorMessage(msg),
    };
  }

  get #toggleContext(): ToggleContext {
    return {
      resource: this.#state.resource as ResourceRef<BudgetDetailsViewModel>,
      onSuccess: () => {
        this.#invalidateCache();
        this.#state.setErrorMessage(null);
      },
      onError: (msg, error) => {
        this.#state.setErrorMessage(msg);
        this.#logger.error(msg, error);
      },
    };
  }

  // ─── Public API ────────────────────────────────────────────────

  setIsShowingOnlyUnchecked(value: boolean): void {
    this.#isShowingOnlyUnchecked.set(value);
  }

  setBudgetId(budgetId: string): void {
    this.#state.setBudgetId(budgetId);
    this.#navigation.setCurrentBudgetId(budgetId);
  }

  async createBudgetLine(budgetLine: BudgetLineCreate): Promise<void> {
    return this.#mutations.createBudgetLine(budgetLine, this.#mutationContext);
  }

  async updateBudgetLine(data: BudgetLineUpdate): Promise<void> {
    return this.#mutations.updateBudgetLine(data, this.#mutationContext);
  }

  async deleteBudgetLine(id: string): Promise<void> {
    return this.#mutations.deleteBudgetLine(id, this.#mutationContext);
  }

  async deleteTransaction(id: string): Promise<void> {
    return this.#mutations.deleteTransaction(id, this.#mutationContext);
  }

  async createAllocatedTransaction(
    transactionData: TransactionCreate,
  ): Promise<void> {
    return this.#mutations.createAllocatedTransaction(
      transactionData,
      this.#mutationContext,
    );
  }

  async resetBudgetLineFromTemplate(id: string): Promise<void> {
    return this.#mutations.resetBudgetLineFromTemplate(
      id,
      this.#mutationContext,
    );
  }

  async toggleCheck(id: string): Promise<void> {
    if (id === 'rollover-display') {
      const currentCheckedAt = this.#state.getRolloverCheckedAt();
      this.#state.setRolloverCheckedAt(
        currentCheckedAt === null ? new Date().toISOString() : null,
      );
      return;
    }

    return this.#toggles.toggleCheck(id, this.#toggleContext);
  }

  async toggleTransactionCheck(id: string): Promise<void> {
    return this.#toggles.toggleTransactionCheck(id, this.#toggleContext);
  }

  reloadBudgetDetails(): void {
    this.#state.reload();
  }

  #invalidateCache(): void {
    this.#invalidationService.invalidate();
  }
}
