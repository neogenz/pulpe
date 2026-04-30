import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SearchBar } from '@ui/index';
import {
  calculateAllEnrichedConsumptions,
  type BudgetLineConsumption,
} from '@core/budget';
import { STORAGE_KEYS, StorageService } from '@core/storage';
import {
  type BudgetLine,
  type BudgetLineUpdate,
  type Transaction,
  type TransactionUpdate,
} from 'pulpe-shared';
import { UserSettingsStore } from '@core/user-settings';
import { AppCurrencyPipe, CURRENCY_CONFIG } from '@core/currency';
import { Logger } from '@core/logging/logger';
import { map } from 'rxjs/operators';
import { BudgetGrid } from './budget-grid';
import { BudgetTable } from './budget-table/budget-table';
import type {
  BudgetLineTableItem,
  TransactionTableItem,
} from './view-models/table-items.view-model';
import type { BudgetViewMode } from './view-models/budget-view-mode';
import { BudgetItemDataProvider } from './view-models/budget-item-data-provider';
import { BudgetViewToggle } from './components';
import { BudgetTableCheckedFilter } from './budget-table/budget-table-checked-filter';
import { BudgetDetailsDialogService } from './budget-details-dialog.service';
import { BudgetDetailsStore } from './store/budget-details-store';
import { determineCheckBehavior } from './store/budget-details-check.utils';
import {
  computeEnvelopeSnackbarMessage,
  computeTransactionSnackbarMessage,
} from './budget-details-snackbar.utils';

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
        @if (!isMobile()) {
          <pulpe-budget-view-toggle [(viewMode)]="viewMode" />
        }
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

      <!-- Checking summary — progressive disclosure -->
      @if (store.checkedItemsCount() > 0) {
        <p
          class="text-body-medium text-on-surface-variant flex items-center gap-1.5 -mt-1"
          data-testid="checking-summary"
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
          [transactionItems]="transactionItems()"
          [transactions]="store.filteredTransactions()"
          [isMobile]="isMobile()"
          (edit)="startEditBudgetLine($event)"
          (delete)="handleDeleteItem($event)"
          (deleteTransaction)="handleDeleteItem($event)"
          (editTransaction)="handleEditAllocatedTransaction($event)"
          (add)="openAddBudgetLineDialog()"
          (addTransaction)="openCreateAllocatedTransactionDialog($event)"
          (viewTransactions)="onViewTransactions($event)"
          (resetFromTemplate)="onResetFromTemplateClick($event)"
          (toggleCheck)="handleToggleCheck($event)"
          (toggleTransactionCheck)="handleToggleTransactionCheck($event)"
        />
      } @else {
        <pulpe-budget-table
          [tableData]="budgetTableData()"
          (update)="handleUpdateBudgetLine($event)"
          (delete)="handleDeleteItem($event)"
          (add)="openAddBudgetLineDialog()"
          (addTransaction)="openCreateAllocatedTransactionDialog($event)"
          (viewTransactions)="onViewTransactions($event)"
          (resetFromTemplate)="handleResetFromTemplate($event)"
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
            data-testid="add-budget-line"
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
  readonly #snackBar = inject(MatSnackBar);
  readonly #transloco = inject(TranslocoService);
  readonly #logger = inject(Logger);
  readonly #userSettings = inject(UserSettingsStore);

  protected readonly currency = this.#userSettings.currency;
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

  // View Model with pre-computed values
  readonly budgetTableData = computed(() =>
    this.#budgetItemDataProvider.provideTableData({
      budgetLines: this.store.filteredBudgetLines(),
      transactions: this.store.filteredTransactions(),
      viewMode: this.viewMode(),
      searchText: this.store.searchText(),
    }),
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
    );
    if (result) {
      await this.handleUpdateBudgetLine(result);
    }
  }

  protected async handleUpdateBudgetLine(
    data: BudgetLineUpdate,
  ): Promise<void> {
    await this.store.updateBudgetLine(data);
    this.#snackBar.open(
      this.#transloco.translate('budget.modificationSaved'),
      this.#transloco.translate('common.close'),
      { duration: 5000 },
    );
  }

  protected async onViewTransactions(item: BudgetLineTableItem): Promise<void> {
    const consumption = this.#consumptions().get(item.data.id);
    if (!consumption) return;
    await this.openAllocatedTransactionsDialog({
      budgetLine: item.data,
      consumption,
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

    const transaction =
      await this.#dialogService.openCreateAllocatedTransactionDialog(
        budgetLine,
        this.isMobile(),
        {
          budgetMonth: budget.month,
          budgetYear: budget.year,
          payDayOfMonth: this.#userSettings.payDayOfMonth(),
        },
      );

    if (transaction) {
      await this.store.createAllocatedTransaction(transaction);
      this.#snackBar.open(
        this.#transloco.translate('budget.transactionAdded'),
        this.#transloco.translate('common.close'),
        { duration: 3000 },
      );
    }
  }

  protected async handleEditAllocatedTransaction(
    transaction: Transaction,
  ): Promise<void> {
    const budget = this.store.budgetDetails();
    if (!budget) return;
    const editResult =
      await this.#dialogService.openEditAllocatedTransactionDialog(
        transaction,
        {
          budgetMonth: budget.month,
          budgetYear: budget.year,
          payDayOfMonth: this.#userSettings.payDayOfMonth(),
        },
      );
    if (editResult) {
      await this.handleUpdateTransaction(editResult);
    }
  }

  protected async handleUpdateTransaction(
    data: TransactionUpdate & { id: string },
  ): Promise<void> {
    await this.store.updateTransaction(data.id, data);
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

    if (confirmed) {
      await this.store.deleteTransaction(transaction.id);
      this.#snackBar.open(
        this.#transloco.translate('transaction.deleted'),
        this.#transloco.translate('common.close'),
        { duration: 3000 },
      );
    }
  }

  protected async handleToggleCheck(budgetLineId: string): Promise<void> {
    if (budgetLineId.startsWith('rollover')) {
      await this.store.toggleCheck(budgetLineId);
      return;
    }

    const details = this.store.budgetDetails();
    if (!details) return;

    const behavior = determineCheckBehavior(
      budgetLineId,
      details.budgetLines,
      details.transactions ?? [],
    );

    const shouldCascade =
      behavior === 'ask-cascade' &&
      (await this.#dialogService.confirmCheckAllocatedTransactions());

    const succeeded = await this.store.toggleCheck(budgetLineId);
    if (!succeeded) return;

    if (shouldCascade) {
      await this.store.checkAllAllocatedTransactions(budgetLineId);
    }

    this.#showEnvelopeSnackbar(budgetLineId);
  }

  protected async handleToggleTransactionCheck(
    transactionId: string,
  ): Promise<void> {
    await this.store.toggleTransactionCheck(transactionId);
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
    try {
      await this.store.resetBudgetLineFromTemplate(budgetLineId);
      this.#snackBar.open(
        this.#transloco.translate('budget.forecastReset'),
        this.#transloco.translate('common.close'),
        { duration: 5000 },
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : this.#transloco.translate('common.error');
      this.#snackBar.open(
        errorMessage,
        this.#transloco.translate('common.close'),
        {
          duration: 5000,
          panelClass: ['bg-error-container', 'text-on-error-container'],
        },
      );
    }
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
      await this.store.deleteBudgetLine(id);
    } else {
      await this.store.deleteTransaction(id);
      this.#snackBar.open(
        this.#transloco.translate('transaction.deleted'),
        this.#transloco.translate('common.close'),
        { duration: 5000 },
      );
    }
  }

  async openAddBudgetLineDialog(): Promise<void> {
    const budget = this.store.budgetDetails();
    if (!budget) return;

    const budgetLine = await this.#dialogService.openAddBudgetLineDialog(
      budget.id,
    );
    if (budgetLine) {
      await this.store.createBudgetLine(budgetLine);
    }
  }
}
