import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  linkedSignal,
  LOCALE_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SearchBar } from '@ui/index';
import {
  calculateAllEnrichedConsumptions,
  calculateBudgetLineConsumption,
  type BudgetLineConsumption,
} from '@core/budget';
import { STORAGE_KEYS, StorageService } from '@core/storage';
import {
  type BudgetLine,
  type BudgetLineSpreadResponse,
  type BudgetLineUpdate,
  type BudgetPeriod,
  type SupportedCurrency,
  type Transaction,
} from 'pulpe-shared';
import { UserSettingsStore } from '@core/user-settings';
import { AppCurrencyPipe, CURRENCY_CONFIG } from '@core/currency';
import { TagStore } from '@core/tag';
import { Logger } from '@core/logging/logger';
import { map } from 'rxjs/operators';
import { BudgetGrid } from './budget-grid';
import { BudgetTable } from './budget-table/budget-table';
import { offsetMonth } from '../budget-line/create/spread.utils';
import type {
  BudgetLineTableItem,
  TransactionTableItem,
} from '../view-models/table-items.view-model';
import type { BudgetViewMode } from '../view-models/budget-view-mode';
import { BudgetItemDataProvider } from '../view-models/budget-item-data-provider';
import {
  collectPresentTagIds,
  filterTableRowsByTags,
} from '../view-models/tag-filter.util';
import { BudgetViewToggle } from './budget-view-toggle';
import { BudgetTableCheckedFilter } from './budget-table/budget-table-checked-filter';
import { BudgetTagFilter } from './budget-table/budget-tag-filter';
import { BudgetDetailsDialogService } from '../budget-details-dialog.service';
import { type WithdrawalRealizationContext } from '../allocated-transactions/create-dialog/form';
import {
  BudgetDetailsStore,
  type MutationOutcome,
} from '../store/budget-details-store';
import { determineCheckBehavior } from '../store/budget-details-check.utils';
import {
  computeEnvelopeSnackbarMessage,
  computeSpreadSnackbarMessage,
  computeTransactionSnackbarMessage,
  openMutationErrorSnackbar,
  spreadCreateEcho,
  submitSavingsWithdrawalWithRetry,
  submitSpreadWithRetry,
} from '../utils/budget-details-snackbar.utils';

/**
 * Unified container component for displaying budget items.
 * Orchestrates between grid view (cards) and table view (mat-table).
 */
@Component({
  selector: 'pulpe-budget-items',
  imports: [
    AppCurrencyPipe,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TranslocoPipe,
    SearchBar,
    BudgetGrid,
    BudgetTable,
    BudgetViewToggle,
    BudgetTableCheckedFilter,
    BudgetTagFilter,
  ],
  providers: [BudgetItemDataProvider],
  template: `
    <div class="flex flex-col gap-4">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-title-large font-medium">
            {{ 'budget.envelopes' | transloco }}
          </h2>
          <p class="text-body-medium text-on-surface-variant">
            {{
              'budget.forecastsThisMonth'
                | transloco: { count: store.totalBudgetLinesCount() }
            }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          @if (allUserTags().length > 0) {
            <button
              matButton
              (click)="openTagHistoryDialog()"
              [attr.aria-label]="'tagHistory.openAriaLabel' | transloco"
              data-testid="tag-history-open"
            >
              <mat-icon>insights</mat-icon>
              <span class="hidden sm:inline">{{
                'tagHistory.open' | transloco
              }}</span>
            </button>
          }
          @if (!isMobile()) {
            <pulpe-budget-view-toggle [(viewMode)]="viewMode" />
          }
        </div>
      </div>

      <!-- Search -->
      <pulpe-search-bar
        [placeholder]="'budget.searchPlaceholder' | transloco"
        [value]="store.searchText()"
        (valueChange)="store.setSearchText($event)"
      />

      <!-- Filter -->
      <pulpe-budget-table-checked-filter
        [isShowingOnlyUnchecked]="store.isShowingOnlyUnchecked()"
        (isShowingOnlyUncheckedChange)="store.setIsShowingOnlyUnchecked($event)"
      />

      <!-- Tag filter (PUL-18) — hidden when the budget has no tagged items -->
      @if (availableTags().length > 0) {
        <pulpe-budget-tag-filter
          [tags]="availableTags()"
          [selectedTagIds]="selectedTagIds()"
          (selectedTagIdsChange)="selectedTagIds.set($event)"
        />
      }

      <!-- Checking summary — progressive disclosure -->
      @if (store.checkedItemsCount() > 0) {
        <p
          class="text-body-medium text-on-surface-variant flex items-center gap-1.5 -mt-1"
          data-testid="budget-items-checking-summary"
        >
          @if (isAllChecked()) {
            <mat-icon aria-hidden="true" class="text-primary text-base!"
              >check_circle</mat-icon
            >
            <span>{{ 'budget.allChecked' | transloco }}</span>
          } @else {
            <span>{{
              'budget.checkedSummary'
                | transloco
                  : {
                      checked: store.checkedItemsCount(),
                      total: store.totalItemsCount(),
                    }
            }}</span>
          }
          <span class="text-on-surface-variant/50">·</span>
          <span class="ph-no-capture">
            {{
              'budget.accountBalance'
                | transloco
                  : {
                      amount:
                        (store.realizedBalance()
                        | appCurrency: currency() : '1.0-0'),
                    }
            }}
          </span>
          <mat-icon
            [matTooltip]="'budget.estimatedBalanceTooltip' | transloco"
            matTooltipPosition="above"
            matTooltipTouchGestures="auto"
            [attr.aria-label]="'budget.estimatedBalanceInfo' | transloco"
            role="img"
            tabindex="0"
            class="text-on-surface-variant/50 text-base! cursor-help"
            >info</mat-icon
          >
        </p>
      }

      <!-- Content -->
      @if (budgetTableData().length === 0 && store.searchText()) {
        <div
          class="flex flex-col items-center gap-2 py-8 text-on-surface-variant"
        >
          <mat-icon class="!text-5xl !w-12 !h-12">search_off</mat-icon>
          <p class="text-body-large">
            {{ 'budget.noForecastFound' | transloco }}
          </p>
        </div>
      } @else if (
        budgetTableData().length === 0 &&
        store.isShowingOnlyUnchecked() &&
        store.totalBudgetLinesCount() > 0
      ) {
        <div class="text-center py-12 px-4">
          <div
            class="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-container/30 flex items-center justify-center"
          >
            <mat-icon class="text-primary shrink-0">check_circle</mat-icon>
          </div>
          <p class="text-body-large text-on-surface mb-2">
            {{ 'budget.allCheckedFilterEmpty' | transloco }}
          </p>
          <p class="text-body-medium text-on-surface-variant">
            {{ 'budget.allCheckedFilterDescription' | transloco }}
          </p>
        </div>
      } @else if (isMobile() || viewMode() === 'envelopes') {
        <pulpe-budget-grid
          [currency]="currency()"
          [budgetLineItems]="budgetLineItems()"
          [savingsGoalNameById]="store.savingsGoalNameById()"
          [transactionItems]="transactionItems()"
          [transactions]="store.filteredTransactions()"
          [isMobile]="isMobile()"
          [hasNextMonthBudget]="store.hasNextMonthBudget()"
          [nextMonthLabel]="store.nextMonthLabel()"
          (edit)="startEditBudgetLine($event)"
          (delete)="handleDeleteItem($event)"
          (deleteTransaction)="handleDeleteItem($event)"
          (editTransaction)="handleEditAllocatedTransaction($event)"
          (add)="openAddBudgetLineDialog()"
          (addTransaction)="openCreateAllocatedTransactionDialog($event)"
          (viewTransactions)="onViewTransactions($event)"
          (spread)="handleSpreadBudgetLine($event)"
          (spreadTransaction)="handleSpreadTransaction($event)"
          (resetFromTemplate)="onResetFromTemplateClick($event)"
          (postpone)="handlePostponeBudgetLine($event)"
          (postponeTransaction)="handlePostponeTransaction($event)"
          (toggleCheck)="handleToggleCheck($event)"
          (toggleTransactionCheck)="handleToggleTransactionCheck($event)"
        />
      } @else {
        <pulpe-budget-table
          [tableData]="budgetTableData()"
          [savingsGoalNameById]="store.savingsGoalNameById()"
          [budgetPeriod]="budgetPeriod()"
          (update)="handleUpdateBudgetLine($event)"
          (delete)="handleDeleteItem($event)"
          (add)="openAddBudgetLineDialog()"
          (addTransaction)="openCreateAllocatedTransactionDialog($event)"
          (viewTransactions)="onViewTransactions($event)"
          (spread)="handleSpreadBudgetLine($event)"
          (spreadTransaction)="handleSpreadTransaction($event)"
          (resetFromTemplate)="handleResetFromTemplate($event)"
          (postpone)="handlePostponeItem($event)"
          (toggleCheck)="handleToggleCheck($event)"
          (toggleTransactionCheck)="handleToggleTransactionCheck($event)"
        />
      }

      <!-- Footer -->
      @if (budgetTableData().length > 0) {
        <div class="flex justify-center pt-2">
          <button
            matButton
            (click)="openAddBudgetLineDialog()"
            data-testid="budget-items-add-line-button"
            data-tour="add-budget-line"
            class="gap-2 !h-11 !rounded-full !px-6"
          >
            <mat-icon>add</mat-icon>
            {{ 'budget.addEnvelope' | transloco }}
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetItemsContainer {
  readonly #breakpointObserver = inject(BreakpointObserver);
  readonly #budgetItemDataProvider = inject(BudgetItemDataProvider);
  readonly #dialogService = inject(BudgetDetailsDialogService);
  readonly #storageService = inject(StorageService);
  protected readonly store = inject(BudgetDetailsStore);
  readonly #destroyRef = inject(DestroyRef);
  readonly #snackBar = inject(MatSnackBar);
  readonly #transloco = inject(TranslocoService);
  readonly #logger = inject(Logger);
  readonly #userSettings = inject(UserSettingsStore);
  readonly #tagStore = inject(TagStore);
  readonly #currencyPipe = new AppCurrencyPipe();
  readonly #monthFormatter = new Intl.DateTimeFormat(inject(LOCALE_ID), {
    month: 'long',
  });

  protected readonly currency = this.#userSettings.currency;

  // Tag filter (PUL-18) — local UI state; applied on the built rows so the
  // consumption figures baked into each row stay correct.
  readonly #lastLoadedBudgetId = linkedSignal<
    string | undefined,
    string | undefined
  >({
    source: () => this.store.budgetDetails()?.id,
    computation: (budgetId, previous) => budgetId ?? previous?.value,
  });
  readonly selectedTagIds = linkedSignal<string | undefined, string[]>({
    source: this.#lastLoadedBudgetId,
    computation: () => [],
  });
  readonly #selectedTagIdSet = computed(() => new Set(this.selectedTagIds()));

  readonly allUserTags = computed(() =>
    [...(this.#tagStore.tags.value() ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  );

  readonly availableTags = computed(() => {
    const details = this.store.budgetDetails();
    if (!details) return [];
    const presentIds = collectPresentTagIds([
      ...details.budgetLines,
      ...(details.transactions ?? []),
    ]);
    const nameById = this.#tagStore.tagNameById();
    return [...presentIds]
      .map((id) => ({ id, name: nameById.get(id) ?? id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
  protected readonly locale = computed(
    () => CURRENCY_CONFIG[this.currency()].numberLocale,
  );

  protected readonly isAllChecked = computed(
    () =>
      this.store.totalItemsCount() > 0 &&
      this.store.checkedItemsCount() === this.store.totalItemsCount(),
  );

  // View mode toggle state (persisted in localStorage for desktop)
  readonly viewMode = signal<BudgetViewMode>(this.#getInitialViewMode());

  // Responsive
  readonly isMobile = toSignal(
    this.#breakpointObserver
      .observe(Breakpoints.Handset)
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  // Full consumption data
  readonly #consumptions = computed(() =>
    calculateAllEnrichedConsumptions(
      this.store.filteredBudgetLines(),
      this.store.filteredTransactions(),
    ),
  );

  // View Model with pre-computed values (before the tag filter)
  readonly #tableRows = computed(() =>
    this.#budgetItemDataProvider.provideTableData({
      budgetLines: this.store.filteredBudgetLines(),
      transactions: this.store.filteredTransactions(),
      openingBalance: this.store.previousMonthRollover(),
      viewMode: this.viewMode(),
      searchText: this.store.searchText(),
      postpone: {
        hasNextMonthBudget: this.store.hasNextMonthBudget(),
        nextMonthLabel: this.store.nextMonthLabel(),
      },
      savingsWithdrawalOriginLabel: this.store.savingsWithdrawalOriginLabel(),
    }),
  );

  // Period of the displayed budget. Before it loads there is no table to edit
  // from, so the current period is a harmless stand-in rather than a null case
  // every consumer would have to carry.
  readonly budgetPeriod = computed<BudgetPeriod>(() => {
    const budget = this.store.budgetDetails();
    const now = new Date();
    return budget
      ? { month: budget.month, year: budget.year }
      : { month: now.getMonth() + 1, year: now.getFullYear() };
  });

  readonly budgetTableData = computed(() =>
    filterTableRowsByTags(
      this.#tableRows(),
      this.#selectedTagIdSet(),
      this.store.filteredTransactions(),
    ),
  );

  // Filtered items for grid view
  readonly budgetLineItems = computed(() =>
    this.budgetTableData().filter(
      (item): item is BudgetLineTableItem =>
        item.metadata.itemType === 'budget_line',
    ),
  );

  readonly transactionItems = computed(() =>
    this.budgetTableData().filter(
      (item): item is TransactionTableItem =>
        item.metadata.itemType === 'transaction',
    ),
  );

  constructor() {
    // Persist view mode changes to localStorage (desktop only)
    effect(() => {
      const mode = this.viewMode();
      const mobile = this.isMobile();
      if (!mobile) {
        this.#storageService.setString(STORAGE_KEYS.BUDGET_DESKTOP_VIEW, mode);
      }
    });
  }

  #getInitialViewMode(): BudgetViewMode {
    const stored = this.#storageService.getString(
      STORAGE_KEYS.BUDGET_DESKTOP_VIEW,
    );
    if (stored === 'table') {
      return 'table';
    }
    return 'envelopes';
  }

  protected async startEditBudgetLine(
    item: BudgetLineTableItem,
  ): Promise<void> {
    const result = await this.#dialogService.openEditBudgetLineDialog(
      item.data,
      this.budgetPeriod(),
    );
    if (result) {
      await this.handleUpdateBudgetLine(result);
    }
  }

  protected async handleUpdateBudgetLine(
    data: BudgetLineUpdate,
  ): Promise<void> {
    const error = await this.store.updateBudgetLine(data);
    if (error) {
      openMutationErrorSnackbar(error, this.#snackBar, this.#transloco);
      return;
    }
    this.#snackBar.open(
      this.#transloco.translate('budget.modificationSaved'),
      this.#transloco.translate('common.close'),
      { duration: 5000 },
    );
  }

  protected async onViewTransactions(item: BudgetLineTableItem): Promise<void> {
    const consumption = this.#consumptions().get(item.data.id);
    if (!consumption) return;
    // PUL-17 — load the spread group so the detail dialog can show the
    // cross-month occurrences section; null clears it for non-spread lines.
    this.store.setSpreadGroupId(item.data.spreadGroupId ?? null);
    await this.openAllocatedTransactionsDialog({
      budgetLine: item.data,
      consumption,
    });
  }

  protected async handleSpreadBudgetLine(
    item: BudgetLineTableItem,
  ): Promise<void> {
    const budget = this.store.budgetDetails();
    if (!budget) return;

    const result = await this.#dialogService.openSpreadExisting({
      source: 'forecast',
      total: item.data.amount,
      month: budget.month,
      year: budget.year,
    });
    if (!result) return;

    const outcome = await this.#dialogService.runSpreadProcessing(
      () => this.store.spreadExistingBudgetLine(item.data.id, result.periods),
      {
        amount: item.data.amount,
        monthCount: result.periods.length,
        currency: this.currency(),
      },
    );
    this.#notifySpread(outcome);
  }

  protected async handleSpreadTransaction(item: Transaction): Promise<void> {
    const budget = this.store.budgetDetails();
    if (!budget) return;

    const result = await this.#dialogService.openSpreadExisting({
      source: 'transaction',
      total: item.amount,
      month: budget.month,
      year: budget.year,
    });
    if (!result) return;

    const outcome = await this.#dialogService.runSpreadProcessing(
      () => this.store.spreadExistingTransaction(item.id, result.periods),
      {
        amount: item.amount,
        monthCount: result.periods.length,
        currency: this.currency(),
      },
    );
    this.#notifySpread(outcome);
  }

  #notifySpread(
    outcome: MutationOutcome<BudgetLineSpreadResponse['data']>,
  ): void {
    if (outcome.error) {
      openMutationErrorSnackbar(outcome.error, this.#snackBar, this.#transloco);
      return;
    }
    const spread = outcome.data;
    if (!spread) return;
    const snackbarRef = this.#snackBar.open(
      computeSpreadSnackbarMessage(spread, this.#transloco),
      this.#transloco.translate('budgetLine.spread.successAction'),
      { duration: 6000 },
    );
    snackbarRef
      .onAction()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => {
        this.store.setSpreadGroupId(spread.spreadGroupId);
        this.#dialogService.openSpreadOccurrences(this.isMobile());
      });
  }

  protected async openAllocatedTransactionsDialog(event: {
    budgetLine: BudgetLine;
    consumption: BudgetLineConsumption;
  }): Promise<void> {
    const result = await this.#dialogService.openAllocatedTransactionsDialog(
      event,
      this.isMobile(),
      {
        onToggleTransactionCheck: (id) => this.handleToggleTransactionCheck(id),
      },
    );

    if (!result) return;

    if (result.action === 'add') {
      await this.openCreateAllocatedTransactionDialog(event.budgetLine);
    } else if (result.action === 'delete' && result.transaction) {
      await this.handleDeleteTransaction(result.transaction);
    } else if (result.action === 'edit' && result.transaction) {
      await this.handleEditAllocatedTransaction(result.transaction);
    }
  }

  protected async openCreateAllocatedTransactionDialog(
    budgetLine: BudgetLine,
  ): Promise<void> {
    const budget = this.store.budgetDetails();
    if (!budget) {
      this.#logger.warn(
        'Cannot open create transaction dialog: budget not loaded',
      );
      return;
    }

    // PUL-329 v2 — la boîte soumet elle-même : un refus de solde y reste
    // affiché avec la saisie intacte, et seule une création acceptée la ferme.
    const transaction =
      await this.#dialogService.openCreateAllocatedTransactionDialog(
        budgetLine,
        this.isMobile(),
        {
          budgetMonth: budget.month,
          budgetYear: budget.year,
          payDayOfMonth: this.#userSettings.payDayOfMonth(),
        },
        (tx) => this.store.createAllocatedTransaction(tx),
        this.#withdrawalRealizationContext(budgetLine),
      );

    if (!transaction) return;

    this.#snackBar.open(
      this.#transloco.translate('budget.transactionAdded'),
      this.#transloco.translate('common.close'),
      { duration: 3000 },
    );
  }

  // PUL-329 QA fix — the dialog now owns submission (it awaits the store
  // mutation itself and only closes on success). This caller just supplies
  // that mutation and keeps the success toast for after closure.
  protected async handleEditAllocatedTransaction(
    transaction: Transaction,
  ): Promise<void> {
    const budget = this.store.budgetDetails();
    if (!budget) return;
    const updated =
      await this.#dialogService.openEditAllocatedTransactionDialog(
        transaction,
        {
          budgetMonth: budget.month,
          budgetYear: budget.year,
          payDayOfMonth: this.#userSettings.payDayOfMonth(),
        },
        (update) => this.store.updateTransaction(transaction.id, update),
      );
    if (!updated) return;
    this.#snackBar.open(
      this.#transloco.translate('budget.modificationSaved'),
      this.#transloco.translate('common.close'),
      { duration: 5000 },
    );
  }

  protected async handleDeleteTransaction(
    transaction: Transaction,
  ): Promise<void> {
    const confirmed = await this.#dialogService.confirmDelete({
      title: this.#transloco.translate('budget.deleteTransaction'),
      message: this.#transloco.translate('transaction.deleteConfirm', {
        name: transaction.name,
      }),
    });

    if (!confirmed) return;

    const error = await this.store.deleteTransaction(transaction.id);
    if (error) {
      openMutationErrorSnackbar(error, this.#snackBar, this.#transloco);
      return;
    }
    this.#snackBar.open(
      this.#transloco.translate('transaction.deleted'),
      this.#transloco.translate('common.close'),
      { duration: 3000 },
    );
  }

  /**
   * PUL-329 v2 — reste à sortir d'un retrait annoncé, `null` pour toute autre
   * ligne. Une source orpheline garde son nom snapshot : le formulaire l'affiche
   * sans pouvoir la rattacher.
   */
  #withdrawalRealizationContext(
    budgetLine: BudgetLine,
  ): WithdrawalRealizationContext | null {
    if (!budgetLine.sourceSavingsGoalName) return null;
    const details = this.store.budgetDetails();
    const { remaining } = calculateBudgetLineConsumption(
      budgetLine,
      details?.transactions ?? [],
    );
    return {
      goalId: budgetLine.sourceSavingsGoalId ?? null,
      goalName: budgetLine.sourceSavingsGoalName,
      remainingAmount: Math.max(0, remaining),
    };
  }

  protected async handleToggleCheck(budgetLineId: string): Promise<void> {
    const details = this.store.budgetDetails();
    if (!details) return;

    // PUL-329 v2 — sur un retrait annoncé, le geste ne pointe pas la prévision :
    // il ouvre la saisie du revenu réel, seul mouvement qui débite l'objectif.
    // Une source orpheline retombe sur la bascule ordinaire, comme le backend.
    const sourceLine = details.budgetLines.find(
      (line) => line.id === budgetLineId && line.sourceSavingsGoalId,
    );
    if (sourceLine) {
      await this.openCreateAllocatedTransactionDialog(sourceLine);
      return;
    }

    const behavior = determineCheckBehavior(
      budgetLineId,
      details.budgetLines,
      details.transactions ?? [],
    );

    const shouldCascade =
      behavior === 'ask-cascade' &&
      (await this.#dialogService.confirmCheckAllocatedTransactions());

    const outcome = await this.store.toggleCheck(budgetLineId);
    if (outcome.status === 'failed') {
      openMutationErrorSnackbar(
        outcome.reason,
        this.#snackBar,
        this.#transloco,
      );
      return;
    }
    if (outcome.status === 'skipped') return;

    if (shouldCascade) {
      const cascadeOutcome =
        await this.store.checkAllAllocatedTransactions(budgetLineId);
      if (cascadeOutcome.status === 'failed') {
        openMutationErrorSnackbar(
          cascadeOutcome.reason,
          this.#snackBar,
          this.#transloco,
        );
        return;
      }
    }

    this.#showEnvelopeSnackbar(budgetLineId);
  }

  protected async handleToggleTransactionCheck(
    transactionId: string,
  ): Promise<void> {
    const outcome = await this.store.toggleTransactionCheck(transactionId);
    if (outcome.status === 'failed') {
      openMutationErrorSnackbar(
        outcome.reason,
        this.#snackBar,
        this.#transloco,
      );
      return;
    }
    if (outcome.status === 'skipped') return;
    this.#showTransactionSnackbar(transactionId);
  }

  #showEnvelopeSnackbar(budgetLineId: string): void {
    const details = this.store.budgetDetails();
    if (!details) return;
    const message = computeEnvelopeSnackbarMessage(
      budgetLineId,
      details.budgetLines,
      details.transactions,
      this.#userSettings.currency(),
      this.#transloco,
    );
    if (message) this.#snackBar.open(message, undefined, { duration: 3000 });
  }

  #showTransactionSnackbar(transactionId: string): void {
    const details = this.store.budgetDetails();
    if (!details) return;
    const message = computeTransactionSnackbarMessage(
      transactionId,
      details.transactions,
      this.#userSettings.currency(),
      this.#transloco,
    );
    if (message) this.#snackBar.open(message, undefined, { duration: 3000 });
  }

  protected onResetFromTemplateClick(item: BudgetLineTableItem): void {
    this.handleResetFromTemplate(item.data.id);
  }

  protected async handleResetFromTemplate(budgetLineId: string): Promise<void> {
    const error = await this.store.resetBudgetLineFromTemplate(budgetLineId);
    if (error) {
      openMutationErrorSnackbar(error, this.#snackBar, this.#transloco);
      return;
    }
    this.#snackBar.open(
      this.#transloco.translate('budget.forecastReset'),
      this.#transloco.translate('common.close'),
      { duration: 5000 },
    );
  }

  protected async handlePostponeBudgetLine(
    budgetLineId: string,
  ): Promise<void> {
    await this.#postpone(() => this.store.postponeBudgetLine(budgetLineId));
  }

  protected async handlePostponeTransaction(
    transactionId: string,
  ): Promise<void> {
    await this.#postpone(() => this.store.postponeTransaction(transactionId));
  }

  // The budget-table renders both budget lines and free transactions through a
  // single `postpone` output (id only), so route by item type — mirrors
  // handleDeleteItem.
  protected async handlePostponeItem(id: string): Promise<void> {
    const data = this.store.budgetDetails();
    if (!data) return;

    const isBudgetLine = data.budgetLines.some((line) => line.id === id);
    if (isBudgetLine) {
      await this.handlePostponeBudgetLine(id);
    } else {
      await this.handlePostponeTransaction(id);
    }
  }

  async #postpone(mutate: () => Promise<string | null>): Promise<void> {
    const nextMonthLabel = this.store.nextMonthLabel();
    const confirmed = await this.#dialogService.confirmPostpone(nextMonthLabel);
    if (!confirmed) return;

    const error = await mutate();

    if (error) {
      openMutationErrorSnackbar(error, this.#snackBar, this.#transloco);
      return;
    }

    this.#snackBar.open(
      this.#transloco.translate('budget.postponed', { month: nextMonthLabel }),
      this.#transloco.translate('common.close'),
      { duration: 5000 },
    );
  }

  protected async handleDeleteItem(id: string): Promise<void> {
    const data = this.store.budgetDetails();
    if (!data) return;

    const budgetLine = data.budgetLines.find((line) => line.id === id);
    const transaction = data.transactions.find((tx) => tx.id === id);

    if (!budgetLine && !transaction) {
      this.#logger.error('Item not found', { id });
      return;
    }

    // PUL-292 — a line linked to a pioche opens the 3-way choice, not the binary
    // confirm: deleting one half must let the user keep the Revenu or cancel both.
    if (budgetLine?.savingsWithdrawalGroupId) {
      await this.#deleteLinkedWithdrawal(budgetLine);
      return;
    }

    const isBudgetLine = !!budgetLine;
    const title = isBudgetLine
      ? this.#transloco.translate('budget.deleteForecast')
      : this.#transloco.translate('budget.deleteTransaction');
    const message = this.#transloco.translate('budget.irreversibleAction');

    const confirmed = await this.#dialogService.confirmDelete({
      title,
      message,
    });

    if (!confirmed) return;

    if (isBudgetLine) {
      // A removed forecast is its own confirmation: the row is gone. Only its
      // refusal needs saying.
      const error = await this.store.deleteBudgetLine(id);
      if (error) {
        openMutationErrorSnackbar(error, this.#snackBar, this.#transloco);
      }
      return;
    }

    const error = await this.store.deleteTransaction(id);
    if (error) {
      openMutationErrorSnackbar(error, this.#snackBar, this.#transloco);
      return;
    }
    this.#snackBar.open(
      this.#transloco.translate('transaction.deleted'),
      this.#transloco.translate('common.close'),
      { duration: 5000 },
    );
  }

  protected openTagHistoryDialog(): void {
    const budget = this.store.budgetDetails();
    if (!budget || this.allUserTags().length === 0) return;

    this.#dialogService.openTagHistory({
      tags: this.allUserTags(),
      selectedTagId:
        this.selectedTagIds().length === 1
          ? this.selectedTagIds()[0]
          : undefined,
      endMonth: budget.month,
      endYear: budget.year,
      currency: this.currency(),
    });
  }

  async openAddBudgetLineDialog(): Promise<void> {
    const budget = this.store.budgetDetails();
    if (!budget) return;

    const result = await this.#dialogService.openAddBudgetLineDialog({
      id: budget.id,
      month: budget.month,
      year: budget.year,
    });
    if (!result) return;

    if (result.mode === 'spread') {
      await submitSpreadWithRetry(
        result.value,
        (value) =>
          this.#dialogService.runSpreadProcessing(
            () => this.store.createBudgetLineSpread(value),
            { ...spreadCreateEcho(value), currency: this.currency() },
          ),
        this.#snackBar,
        this.#transloco,
      );
      return;
    }
    if (result.mode === 'savingsWithdrawal') {
      await this.#openSavingsWithdrawalFlow(budget, result.prefill);
      return;
    }
    const error = await this.store.createBudgetLine(result.value);
    if (error) {
      openMutationErrorSnackbar(error, this.#snackBar, this.#transloco);
    }
  }

  async #openSavingsWithdrawalFlow(
    budget: { id: string; month: number; year: number },
    prefill?: {
      amount: number;
      source: string;
      inputCurrency: SupportedCurrency;
    },
  ): Promise<void> {
    const dto = await this.#dialogService.openSavingsWithdrawalDialog({
      budgetId: budget.id,
      budgetMonth: budget.month,
      budgetYear: budget.year,
      deficitAmount: this.store.savingsWithdrawalDeficit(),
      prefill,
    });
    if (!dto) return;
    await submitSavingsWithdrawalWithRetry(
      dto,
      (value) => this.store.createSavingsWithdrawal(value),
      this.#snackBar,
      this.#transloco,
    );
  }

  // PUL-292 (CA9) — the income line sits on the viewed month M; the M+1 saving
  // repays it, so from the saving's own month the pioche was taken the month
  // before. Both halves carry the group id; kind disambiguates which we deleted.
  async #deleteLinkedWithdrawal(line: BudgetLine): Promise<void> {
    const budget = this.store.budgetDetails();
    const groupId = line.savingsWithdrawalGroupId;
    if (!budget || !groupId) return;

    const incomeMonth =
      line.kind === 'income'
        ? { year: budget.year, month: budget.month }
        : offsetMonth({ year: budget.year, month: budget.month }, -1);
    const savingMonth = offsetMonth(incomeMonth, 1);
    const incomeLabel = this.#formatMonthName(incomeMonth);
    const savingLabel = this.#formatMonthName(savingMonth);
    const amount =
      this.#currencyPipe.transform(line.amount, this.currency(), '1.2-2') ?? '';

    const scope = await this.#dialogService.openLinkedDeleteChoice({
      title: this.#transloco.translate('budget.savingsWithdrawal.deleteTitle'),
      message: this.#transloco.translate(
        'budget.savingsWithdrawal.deleteMessage',
        {
          plus: `+${amount}`,
          minus: `−${amount}`,
          incomeMonth: incomeLabel,
          savingMonth: savingLabel,
        },
      ),
      keepIncomeLabel: this.#transloco.translate(
        'budget.savingsWithdrawal.deleteKeepIncome',
        { month: incomeLabel },
      ),
      deleteAllLabel: this.#transloco.translate(
        'budget.savingsWithdrawal.deleteAll',
      ),
      cancelLabel: this.#transloco.translate('common.cancel'),
    });
    if (!scope) return;

    const error = await this.store.deleteSavingsWithdrawal(groupId, scope);
    if (error) {
      openMutationErrorSnackbar(error, this.#snackBar, this.#transloco);
      return;
    }
    this.#snackBar.open(
      this.#transloco.translate(
        scope === 'pair'
          ? 'budget.savingsWithdrawal.deletedPair'
          : 'budget.savingsWithdrawal.deletedRepayment',
      ),
      this.#transloco.translate('common.close'),
      { duration: 5000 },
    );
  }

  #formatMonthName(period: { month: number; year: number }): string {
    return this.#monthFormatter.format(
      new Date(period.year, period.month - 1, 1),
    );
  }
}
