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
import { BudgetFinancialOverview } from './budget-financial-overview';
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
} from '@pulpe/shared';
import type { BudgetLineConsumption } from '@core/budget';
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
    BudgetFinancialOverview,
    BaseLoading,
  ],
  providers: [BudgetDetailsStore, BudgetLineApi],
  template: `
    <div class="flex flex-col gap-6" data-testid="budget-detail-page">
      @if (store.isLoading()) {
        <pulpe-base-loading
          message="Chargement des détails du budget..."
          size="large"
          [fullHeight]="true"
          testId="budget-details-loading"
        ></pulpe-base-loading>
      } @else if (store.error()) {
        <mat-card class="bg-error-container" appearance="outlined">
          <mat-card-content>
            <div class="flex items-center gap-2 text-on-error-container">
              <mat-icon>error</mat-icon>
              <span>Erreur lors du chargement du budget</span>
            </div>
          </mat-card-content>
        </mat-card>
      } @else if (store.budgetDetails()) {
        @let budget = store.budgetDetails()!;
        @let budgetLines = store.displayBudgetLines();
        @let transactions = budget.transactions;

        <!-- Header -->
        <header class="flex items-start gap-4">
          <button
            matIconButton
            (click)="navigateBack()"
            aria-label="Retour aux budgets"
            data-testid="back-button"
            class="mt-1"
          >
            <mat-icon>arrow_back</mat-icon>
          </button>
          <div class="flex-1">
            <h1 class="text-display-small mb-2">
              {{ displayName() }}
            </h1>
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
            class="mt-1"
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

        <!-- Budget Items Table -->
        <pulpe-budget-table
          [budgetLines]="budgetLines"
          [transactions]="transactions"
          (update)="handleUpdateBudgetLine($event)"
          (delete)="handleDeleteItem($event)"
          (add)="openAddBudgetLineDialog()"
          (viewAllocatedTransactions)="openAllocatedTransactionsDialog($event)"
          (createAllocatedTransaction)="
            openCreateAllocatedTransactionDialog($event)
          "
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
          <p class="text-body-large">Aucun budget trouvé</p>
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

  readonly #isMobile = toSignal(
    this.#breakpointObserver
      .observe(Breakpoints.Handset)
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  id = input.required<string>();

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

  async handleUpdateBudgetLine(data: BudgetLineUpdate): Promise<void> {
    await this.store.updateBudgetLine(data);

    this.#snackBar.open('Prévision modifiée.', 'Fermer', {
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
      ? 'Supprimer la prévision'
      : 'Supprimer la transaction';
    const message = isBudgetLine
      ? 'Êtes-vous sûr de vouloir supprimer cette prévision ?'
      : 'Êtes-vous sûr de vouloir supprimer cette transaction ?';

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

      this.#snackBar.open('Transaction supprimée.', 'Fermer', {
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

      this.#snackBar.open('Transaction ajoutée.', 'Fermer', {
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
        title: 'Supprimer la transaction',
        message: `Voulez-vous supprimer la transaction "${transaction.name}" ?`,
        confirmText: 'Supprimer',
        confirmColor: 'warn',
      } satisfies ConfirmationDialogData,
      width: '400px',
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());

    if (confirmed) {
      await this.store.deleteTransaction(transaction.id);

      this.#snackBar.open('Transaction supprimée.', 'Fermer', {
        duration: 3000,
      });
    }
  }

  async handleResetFromTemplate(budgetLineId: string): Promise<void> {
    try {
      await this.store.resetBudgetLineFromTemplate(budgetLineId);

      this.#snackBar.open(
        'Prévision réinitialisée depuis le modèle.',
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
