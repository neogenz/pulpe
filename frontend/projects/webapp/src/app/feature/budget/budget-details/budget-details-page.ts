import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  computed,
  effect,
  isDevMode,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, map } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { BaseLoading } from '@ui/loading';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { DatePipe } from '@angular/common';
import { Logger } from '@core/logging/logger';
import { BreadcrumbState } from '@core/routing';
import { formatDate } from 'date-fns';
import { frCH } from 'date-fns/locale';
import { BudgetDetailsStore } from './store/budget-details-store';
import { BudgetLineApi } from './budget-line-api/budget-line-api';
import { BudgetTable } from './budget-table/budget-table';
import { BudgetTableCheckedFilter } from './budget-table/budget-table-checked-filter';
import { BudgetFinancialOverview } from './budget-financial-overview';
import { BudgetItemDataProvider, type BudgetLineTableItem } from './data-core';
import {
  AddBudgetLineDialog,
  type BudgetLineDialogData,
} from './create-budget-line/add-budget-line-dialog';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@ui/dialogs/confirmation-dialog';
import {
  type BudgetLineCreate,
  type BudgetLineUpdate,
  type BudgetLine,
  type Transaction,
  type TransactionCreate,
  formatBudgetPeriod,
} from 'pulpe-shared';
import {
  type BudgetLineConsumption,
  calculateAllEnrichedConsumptions,
} from '@core/budget';
import {
  AllocatedTransactionsDialog,
  type AllocatedTransactionsDialogData,
  type AllocatedTransactionsDialogResult,
} from './allocated-transactions-dialog/allocated-transactions-dialog';
import { AllocatedTransactionsBottomSheet } from './allocated-transactions-dialog/allocated-transactions-bottom-sheet';
import {
  CreateAllocatedTransactionDialog,
  type CreateAllocatedTransactionDialogData,
} from './create-allocated-transaction-dialog/create-allocated-transaction-dialog';
import {
  ProductTourService,
  TOUR_START_DELAY,
} from '@core/product-tour/product-tour.service';
import { UserSettingsApi } from '@core/user-settings/user-settings-api';

@Component({
  selector: 'pulpe-budget-details-page',
  imports: [
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
    DatePipe,
    BudgetTable,
    BudgetTableCheckedFilter,
    BudgetFinancialOverview,
    BaseLoading,
  ],
  providers: [BudgetDetailsStore, BudgetLineApi, BudgetItemDataProvider],
  template: `
    <div class="flex flex-col gap-6 min-w-0" data-testid="budget-detail-page">
      @if (store.isLoading()) {
        <pulpe-base-loading
          message="Préparation des détails..."
          size="large"
          [fullHeight]="true"
          testId="budget-details-loading"
        ></pulpe-base-loading>
      } @else if (store.error()) {
        <mat-card class="bg-error-container" appearance="outlined">
          <mat-card-content>
            <div class="flex items-center gap-2 text-on-error-container">
              <mat-icon>error</mat-icon>
              <span>Le budget n'a pas pu être chargé — réessaie</span>
            </div>
          </mat-card-content>
        </mat-card>
      } @else if (store.budgetDetails()) {
        @let budget = store.budgetDetails()!;
        @let budgetLines = store.displayBudgetLines();
        @let transactions = budget.transactions;

        <!-- Header -->
        <header class="flex items-start gap-2 sm:gap-4 min-w-0">
          <button
            matIconButton
            (click)="navigateBack()"
            aria-label="Retour aux budgets"
            data-testid="back-button"
            class="mt-1 flex-shrink-0"
          >
            <mat-icon>arrow_back</mat-icon>
          </button>
          <div class="flex-1 min-w-0">
            <h1
              class="text-headline-medium sm:text-display-small mb-1 truncate"
            >
              {{ displayName() }}
            </h1>
            @if (periodDisplay()) {
              <p
                class="text-label-medium text-on-surface-variant mb-1"
                data-testid="budget-period-display"
              >
                {{ periodDisplay() }}
              </p>
            }
            @if (budget.description) {
              <p class="text-body-large text-on-surface-variant">
                {{ budget.description }}
              </p>
            }
          </div>
          <button
            matIconButton
            (click)="startPageTour()"
            matTooltip="Découvrir cette page"
            aria-label="Aide"
            data-testid="help-button"
            class="mt-1 flex-shrink-0"
          >
            <mat-icon>help_outline</mat-icon>
          </button>
        </header>

        <!-- Financial Overview -->
        <pulpe-budget-financial-overview
          [budgetLines]="budgetLines"
          [transactions]="transactions"
          [realizedBalance]="store.realizedBalance()"
          [realizedExpenses]="store.realizedExpenses()"
          [checkedCount]="store.checkedItemsCount()"
          [totalCount]="store.totalItemsCount()"
          data-tour="financial-overview"
        />

        <!-- Checked Filter -->
        <pulpe-budget-table-checked-filter
          [isShowingOnlyUnchecked]="store.isShowingOnlyUnchecked()"
          (isShowingOnlyUncheckedChange)="
            store.setIsShowingOnlyUnchecked($event)
          "
        />

        <!-- Budget Items Table -->
        <pulpe-budget-table
          [tableData]="tableData()"
          (update)="handleUpdateBudgetLine($event)"
          (delete)="handleDeleteItem($event)"
          (add)="openAddBudgetLineDialog()"
          (viewTransactions)="handleViewTransactions($event)"
          (addTransaction)="handleAddTransaction($event)"
          (resetFromTemplate)="handleResetFromTemplate($event)"
          (toggleCheck)="handleToggleCheck($event)"
          (toggleTransactionCheck)="handleToggleTransactionCheck($event)"
          data-tour="budget-table"
        />

        @if (isDevMode) {
          <!-- Budget Info Card -->
          <mat-card appearance="outlined">
            <mat-card-header>
              <div mat-card-avatar>
                <div
                  class="flex justify-center items-center size-11 bg-primary-container rounded-full"
                >
                  <mat-icon class="text-on-primary-container"
                    >calendar_month</mat-icon
                  >
                </div>
              </div>
              <mat-card-title>Informations du budget</mat-card-title>
              <mat-card-subtitle>Détails et métadonnées</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <div class="text-label-medium text-on-surface-variant">
                    Période
                  </div>
                  <p class="text-body-large">
                    {{ displayName() }}
                  </p>
                </div>
                <div>
                  <div class="text-label-medium text-on-surface-variant">
                    Créé le
                  </div>
                  <p class="text-body-large">
                    {{ budget.createdAt | date: 'short' : '' : 'fr-CH' }}
                  </p>
                </div>
                <div>
                  <div class="text-label-medium text-on-surface-variant">
                    Dernière modification
                  </div>
                  <p class="text-body-large">
                    {{ budget.updatedAt | date: 'short' : '' : 'fr-CH' }}
                  </p>
                </div>
                <div>
                  <div class="text-label-medium text-on-surface-variant">
                    ID du budget
                  </div>
                  <p class="text-body-small font-mono text-on-surface-variant">
                    {{ budget.id }}
                  </p>
                </div>
              </div>
            </mat-card-content>
          </mat-card>
        }
      } @else {
        <div class="flex justify-center items-center h-full">
          <p class="text-body-large">Budget introuvable</p>
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
export default class BudgetDetailsPage {
  readonly isDevMode = isDevMode();
  store = inject(BudgetDetailsStore);
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #dialog = inject(MatDialog);
  readonly #bottomSheet = inject(MatBottomSheet);
  readonly #snackBar = inject(MatSnackBar);
  readonly #logger = inject(Logger);
  readonly #productTourService = inject(ProductTourService);
  readonly #breadcrumbState = inject(BreadcrumbState);
  readonly #breakpointObserver = inject(BreakpointObserver);
  readonly #userSettingsApi = inject(UserSettingsApi);
  readonly #budgetItemDataProvider = inject(BudgetItemDataProvider);

  readonly #isMobile = toSignal(
    this.#breakpointObserver
      .observe(Breakpoints.Handset)
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  id = input.required<string>();

  readonly #consumptions = computed(() =>
    calculateAllEnrichedConsumptions(
      this.store.filteredBudgetLines(),
      this.store.filteredTransactions(),
    ),
  );

  readonly tableData = computed(() =>
    this.#budgetItemDataProvider.provideTableData({
      budgetLines: this.store.filteredBudgetLines(),
      transactions: this.store.filteredTransactions(),
      viewMode: 'table',
    }),
  );

  constructor() {
    effect(() => {
      const budgetId = this.id();
      if (budgetId) {
        this.store.setBudgetId(budgetId);
      }
    });

    effect((onCleanup) => {
      const details = this.store.budgetDetails();
      if (details) {
        const label = formatDate(
          new Date(details.year, details.month - 1, 1),
          'MMMM yyyy',
          { locale: frCH },
        );
        this.#breadcrumbState.setDynamicBreadcrumb(label);

        onCleanup(() => {
          this.#breadcrumbState.clearDynamicBreadcrumb();
        });
      }
    });

    afterNextRender(() => {
      if (!this.#productTourService.hasSeenPageTour('budget-details')) {
        setTimeout(
          () => this.#productTourService.startPageTour('budget-details'),
          TOUR_START_DELAY,
        );
      }
    });
  }

  startPageTour(): void {
    this.#productTourService.startPageTour('budget-details');
  }

  navigateBack(): void {
    this.#router.navigate(['..'], { relativeTo: this.#route });
  }

  displayName = computed(() => {
    const budget = this.store.budgetDetails();
    if (!budget) return '';
    const date = new Date(budget.year, budget.month - 1, 1);
    return formatDate(date, 'MMMM yyyy', { locale: frCH });
  });

  periodDisplay = computed(() => {
    const budget = this.store.budgetDetails();
    const payDayOfMonth = this.#userSettingsApi.payDayOfMonth();
    if (!budget || !payDayOfMonth || payDayOfMonth === 1) return null;
    return formatBudgetPeriod(budget.month, budget.year, payDayOfMonth);
  });

  async openAddBudgetLineDialog(): Promise<void> {
    const budget = this.store.budgetDetails();
    if (!budget) return;

    const dialogRef = this.#dialog.open(AddBudgetLineDialog, {
      data: {
        budgetId: budget.id,
      } satisfies BudgetLineDialogData,
      width: '600px',
      maxWidth: '90vw',
    });

    const budgetLine = await firstValueFrom(dialogRef.afterClosed());
    if (budgetLine) {
      this.handleCreateBudgetLine(budgetLine);
    }
  }

  async handleCreateBudgetLine(budgetLine: BudgetLineCreate): Promise<void> {
    await this.store.createBudgetLine(budgetLine);
  }

  handleViewTransactions(item: BudgetLineTableItem): void {
    const consumption = this.#consumptions().get(item.data.id);
    if (!consumption) return;
    this.openAllocatedTransactionsDialog({
      budgetLine: item.data,
      consumption,
    });
  }

  handleAddTransaction(budgetLine: BudgetLine): void {
    this.openCreateAllocatedTransactionDialog(budgetLine);
  }

  async handleUpdateBudgetLine(data: BudgetLineUpdate): Promise<void> {
    await this.store.updateBudgetLine(data);

    this.#snackBar.open('Modification enregistrée', 'Fermer', {
      duration: 5000,
      panelClass: ['bg-[color-primary]', 'text-[color-on-primary]'],
    });
  }

  async handleDeleteItem(id: string): Promise<void> {
    const data = this.store.budgetDetails();
    if (!data) return;

    // Find the item to determine if it's a budget line or transaction
    const budgetLine = data.budgetLines.find(
      (line: BudgetLine) => line.id === id,
    );
    const transaction = data.transactions.find(
      (tx: Transaction) => tx.id === id,
    );

    if (!budgetLine && !transaction) {
      this.#logger.error('Item not found', { id, budgetId: this.id() });
      return;
    }

    const isBudgetLine = !!budgetLine;
    const title = isBudgetLine
      ? 'Supprimer cette prévision ?'
      : 'Supprimer cette transaction ?';
    const message = isBudgetLine
      ? 'Cette action est irréversible.'
      : 'Cette action est irréversible.';

    const dialogRef = this.#dialog.open(ConfirmationDialog, {
      data: {
        title,
        message,
        confirmText: 'Supprimer',
        confirmColor: 'warn',
      } satisfies ConfirmationDialogData,
      width: '400px',
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());

    if (!confirmed) {
      return;
    }

    if (isBudgetLine) {
      await this.store.deleteBudgetLine(id);
    } else {
      await this.store.deleteTransaction(id);

      this.#snackBar.open('Transaction supprimée', 'Fermer', {
        duration: 5000,
        panelClass: ['bg-[color-primary]', 'text-[color-on-primary]'],
      });
    }
  }

  /**
   * Open dialog or bottom sheet to view allocated transactions for a budget line
   */
  async openAllocatedTransactionsDialog(event: {
    budgetLine: BudgetLine;
    consumption: BudgetLineConsumption;
  }): Promise<void> {
    const data: AllocatedTransactionsDialogData = {
      budgetLine: event.budgetLine,
      consumption: event.consumption,
    };

    let result: AllocatedTransactionsDialogResult | undefined;

    if (this.#isMobile()) {
      // Mobile: use bottom sheet
      const bottomSheetRef = this.#bottomSheet.open(
        AllocatedTransactionsBottomSheet,
        { data },
      );
      result = await firstValueFrom(bottomSheetRef.afterDismissed());
    } else {
      // Desktop: use dialog
      const dialogRef = this.#dialog.open(AllocatedTransactionsDialog, {
        data,
        width: '800px',
        maxWidth: '95vw',
      });
      result = await firstValueFrom(dialogRef.afterClosed());
    }

    if (!result) return;

    if (result.action === 'add') {
      // Open create transaction dialog
      this.openCreateAllocatedTransactionDialog(event.budgetLine);
    } else if (result.action === 'delete' && result.transaction) {
      // Delete transaction with confirmation
      await this.handleDeleteTransaction(result.transaction);
    }
  }

  /**
   * Open dialog to create an allocated transaction
   */
  async openCreateAllocatedTransactionDialog(
    budgetLine: BudgetLine,
  ): Promise<void> {
    const dialogRef = this.#dialog.open(CreateAllocatedTransactionDialog, {
      data: {
        budgetLine,
      } satisfies CreateAllocatedTransactionDialogData,
      width: '600px',
      maxWidth: '90vw',
    });

    const transaction: TransactionCreate | undefined = await firstValueFrom(
      dialogRef.afterClosed(),
    );

    if (transaction) {
      await this.store.createAllocatedTransaction(transaction);

      this.#snackBar.open('Transaction ajoutée', 'Fermer', {
        duration: 3000,
      });
    }
  }

  /**
   * Delete a transaction with confirmation dialog
   */
  async handleDeleteTransaction(transaction: Transaction): Promise<void> {
    const dialogRef = this.#dialog.open(ConfirmationDialog, {
      data: {
        title: 'Supprimer cette transaction ?',
        message: `Tu vas supprimer « ${transaction.name} ». Cette action est irréversible.`,
        confirmText: 'Supprimer',
        confirmColor: 'warn',
      } satisfies ConfirmationDialogData,
      width: '400px',
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());

    if (confirmed) {
      await this.store.deleteTransaction(transaction.id);

      this.#snackBar.open('Transaction supprimée', 'Fermer', {
        duration: 3000,
      });
    }
  }

  async handleResetFromTemplate(budgetLineId: string): Promise<void> {
    try {
      await this.store.resetBudgetLineFromTemplate(budgetLineId);

      this.#snackBar.open(
        'Prévision réinitialisée depuis le modèle',
        'Fermer',
        {
          duration: 5000,
          panelClass: ['bg-[color-primary]', 'text-[color-on-primary]'],
        },
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';

      this.#snackBar.open(errorMessage, 'Fermer', {
        duration: 5000,
        panelClass: ['bg-error-container', 'text-on-error-container'],
      });
    }
  }

  async handleToggleCheck(budgetLineId: string): Promise<void> {
    await this.store.toggleCheck(budgetLineId);
  }

  async handleToggleTransactionCheck(transactionId: string): Promise<void> {
    await this.store.toggleTransactionCheck(transactionId);
  }
}
