import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import {
  MatBottomSheet,
  MatBottomSheetModule,
} from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import {
  MAT_FORM_FIELD_DEFAULT_OPTIONS,
  MatFormFieldModule,
} from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DashboardError } from './components/dashboard-error';
import { BaseLoading } from '@ui/loading';
import { RecurringExpensesList } from './components/recurring-expenses-list';
import { OneTimeExpensesList } from './components/one-time-expenses-list';
import { CurrentMonthStore } from './services/current-month-store';
import { TitleDisplay } from '@core/routing';
import { BudgetProgressBar } from './components/budget-progress-bar';
import { AddTransactionBottomSheet } from './components/add-transaction-bottom-sheet';
import {
  mapBudgetLineToFinancialEntry,
  mapTransactionToFinancialEntry,
} from './utils/financial-entry-mapper';
import { ConfirmationDialog } from '@ui/dialogs/confirmation-dialog';
import { firstValueFrom } from 'rxjs';
import { type TransactionCreate } from '@pulpe/shared';
import { EditTransactionDialog } from './components/edit-transaction-dialog';
import { type FinancialEntryModel } from './models/financial-entry.model';
import { Logger } from '@core/logging/logger';
import {
  ProductTourService,
  TOUR_START_DELAY,
} from '@core/product-tour/product-tour.service';

type TransactionFormData = Pick<
  TransactionCreate,
  'name' | 'amount' | 'kind' | 'category'
>;
type EditTransactionFormData = Pick<
  TransactionCreate,
  'name' | 'amount' | 'kind' | 'category'
> & {
  transactionDate: string;
};

@Component({
  selector: 'pulpe-current-month',
  providers: [
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: {
        appearance: 'outline',
      },
    },
  ],
  imports: [
    BudgetProgressBar,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatBottomSheetModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    RecurringExpensesList,
    DashboardError,
    BaseLoading,
    OneTimeExpensesList,
  ],
  template: `
    <div class="flex flex-col gap-4" data-testid="current-month-page">
      <header
        class="flex justify-between items-center"
        data-testid="page-header"
      >
        <h1
          class="text-headline-medium md:text-display-small"
          data-testid="page-title"
        >
          {{ titleDisplay.currentTitle() }}
        </h1>
        <div class="flex gap-2">
          <button
            matIconButton
            (click)="startPageTour()"
            matTooltip="Découvrir cette page"
            aria-label="Aide"
            data-testid="help-button"
          >
            <mat-icon>help_outline</mat-icon>
          </button>
          <button
            matButton
            (click)="store.refreshData()"
            [disabled]="store.isLoading()"
            data-testid="refresh-button"
          >
            <mat-icon>refresh</mat-icon>
            Actualiser
          </button>
        </div>
      </header>

      @if (store.isLoading()) {
        <pulpe-base-loading
          message="Chargement du tableau de bord..."
          size="large"
          testId="dashboard-loading"
        />
      } @else if (store.error()) {
        <pulpe-dashboard-error
          (reload)="store.refreshData()"
          data-testid="dashboard-error"
        />
      } @else if (store.hasValue()) {
        @if (store.dashboardData()?.budget) {
          <pulpe-budget-progress-bar
            [expenses]="store.totalExpenses()"
            [available]="store.totalAvailable()"
            data-tour="progress-bar"
          />
          <div
            class="flex flex-col gap-4"
            data-testid="dashboard-content"
            data-tour="expense-lists"
          >
            <!--<pulpe-transaction-chip-filter
                data-testid="transaction-chip-filter"
              />-->
            <h3 class="text-title-medium md:text-title-large">
              Liste des dépenses
            </h3>
            @if (selectedTransactions().length > 1) {
              <div class="flex gap-4" data-testid="bulk-actions">
                <!--<button
                    matButton="tonal"
                    (click)="deleteSelectedTransactions()"
                    data-testid="delete-selected-button"
                  >
                    <mat-icon>delete_sweep</mat-icon>
                    Supprimer ({{ selectedTransactions().length }})
                  </button>-->
                <button matButton="tonal" data-testid="merge-selected-button">
                  <mat-icon>call_merge</mat-icon>
                  Fusionner ({{ selectedTransactions().length }})
                </button>
              </div>
            }

            <pulpe-recurring-expenses-list
              [financialEntries]="recurringFinancialItems()"
              data-testid="recurring-expenses-list"
            />
            <pulpe-one-time-expenses-list
              [financialEntries]="oneTimeFinancialItems()"
              [(selectedFinancialEntries)]="selectedTransactions"
              (deleteFinancialEntry)="deleteTransaction($event)"
              (editFinancialEntry)="openEditTransactionDialogAndUpdate($event)"
              data-testid="one-time-expenses-list"
            />
          </div>
        } @else {
          <div class="empty-state" data-testid="empty-state">
            <h2 class="text-title-large mt-4" data-testid="empty-state-title">
              Aucun budget trouvé
            </h2>
            <p
              class="text-body-large text-on-surface-variant mt-2"
              data-testid="empty-state-description"
            >
              Aucun budget n'a été créé pour
              {{ store.budgetDate() | date: 'MMMM yyyy' }}.
            </p>
          </div>
        }
      }
    </div>

    <!-- FAB pour ajouter une transaction -->
    <button
      matFab
      (click)="openAddTransactionBottomSheet()"
      class="fab-button"
      aria-label="Ajouter une transaction"
      data-testid="add-transaction-fab"
      data-tour="add-transaction-fab"
    >
      <mat-icon>add</mat-icon>
    </button>
  `,
  styles: `
    :host {
      display: block;
      position: relative;

      padding-bottom: 100px;

      --mat-button-tonal-container-height: 32px;
      --mat-button-tonal-horizontal-padding: 12px;
      --mat-button-tonal-icon-spacing: 4px;
      --mat-button-tonal-icon-offset: 0;
    }

    .fab-button {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 1000;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CurrentMonth {
  isCreatingTransaction = signal(false);
  selectedTransactions = signal<string[]>([]);
  protected readonly store = inject(CurrentMonthStore);
  protected readonly titleDisplay = inject(TitleDisplay);
  readonly #productTourService = inject(ProductTourService);
  #bottomSheet = inject(MatBottomSheet);
  #dialog = inject(MatDialog);
  #snackBar = inject(MatSnackBar);
  #logger = inject(Logger);

  constructor() {
    afterNextRender(() => {
      if (!this.#productTourService.hasSeenPageTour('current-month')) {
        setTimeout(
          () => this.#productTourService.startPageTour('current-month'),
          TOUR_START_DELAY,
        );
      }
    });
  }

  startPageTour(): void {
    this.#productTourService.startPageTour('current-month');
  }

  recurringFinancialItems = computed<FinancialEntryModel[]>(() => {
    const budgetLines = this.store.displayBudgetLines();
    const budget = this.store.dashboardData()?.budget;

    if (!budget?.id) return [];

    // Filter budget lines with 'fixed' or 'one_off' recurrence (Fixed Block) and map them to Transaction-like objects
    return budgetLines
      .filter(
        (line) => line.recurrence === 'fixed' || line.recurrence === 'one_off',
      )
      .map((line) => mapBudgetLineToFinancialEntry(line, budget.id));
  });
  oneTimeFinancialItems = computed<FinancialEntryModel[]>(() => {
    // For now, show all transactions as variable expenses
    const transactions = this.store.dashboardData()?.transactions ?? [];
    return transactions.map((transaction) =>
      mapTransactionToFinancialEntry(transaction),
    );
  });

  openAddTransactionBottomSheet(): void {
    const bottomSheetRef = this.#bottomSheet.open(AddTransactionBottomSheet, {
      disableClose: false,
      panelClass: 'add-transaction-bottom-sheet',
    });

    bottomSheetRef
      .afterDismissed()
      .subscribe((transaction: TransactionFormData | undefined) => {
        if (transaction) {
          this.onAddTransaction(transaction);
        }
      });
  }

  async onAddTransaction(transaction: TransactionFormData) {
    try {
      this.isCreatingTransaction.set(true);
      const budgetId = this.store.dashboardData()?.budget?.id;
      if (!budgetId) {
        throw new Error('Budget ID not found');
      }
      await this.store.addTransaction({
        budgetId,
        amount: transaction.amount ?? 0,
        name: transaction.name,
        kind: transaction.kind,
        transactionDate: new Date().toISOString(),
        category: transaction.category ?? null,
      });
    } catch (error) {
      this.#logger.error('Error adding transaction:', error);
    } finally {
      this.isCreatingTransaction.set(false);
    }
  }

  async deleteTransaction(transactionId: string): Promise<void> {
    // Find transaction for the confirmation dialog
    const transaction = this.oneTimeFinancialItems().find(
      (t: FinancialEntryModel) => t.id === transactionId,
    );

    if (!transaction) {
      this.#snackBar.open('Transaction non trouvée', 'Fermer', {
        duration: 3000,
      });
      return;
    }

    // Open confirmation dialog
    const dialogRef = this.#dialog.open(ConfirmationDialog, {
      data: {
        title: 'Supprimer la transaction',
        message: `Êtes-vous sûr de vouloir supprimer « ${transaction.name} » ?`,
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
        confirmColor: 'warn' as const,
      },
      width: '400px',
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());

    if (confirmed) {
      try {
        // Delete transaction
        await this.store.deleteTransaction(transactionId);

        // Show success message
        this.#snackBar.open('Transaction supprimée', undefined, {
          duration: 3000,
        });
      } catch (error) {
        this.#logger.error('Error deleting transaction:', error);

        // Show specific error message
        this.#snackBar.open(
          'Une erreur inattendue est survenue. Veuillez réessayer.',
          'Fermer',
          {
            duration: 5000,
          },
        );
      }
    }
  }

  async openEditTransactionDialogAndUpdate(
    transactionId: string,
  ): Promise<void> {
    // Find transaction to edit
    const transaction = this.store
      .dashboardData()
      ?.transactions.find((transaction) => transaction.id === transactionId);

    if (!transaction) return;

    // Open edit dialog
    const dialogRef = this.#dialog.open(EditTransactionDialog, {
      data: {
        transaction,
      },
      width: '500px',
      maxWidth: '90vw',
    });

    const updatedData = await firstValueFrom<
      EditTransactionFormData | undefined
    >(dialogRef.afterClosed());

    if (!updatedData) {
      return;
    }

    try {
      // Update transaction
      await this.store.updateTransaction(transactionId, {
        name: updatedData.name,
        amount: updatedData.amount ?? undefined,
        kind: updatedData.kind,
        transactionDate: updatedData.transactionDate,
        category: updatedData.category,
      });

      // Show success message
      this.#snackBar.open('Transaction modifiée', undefined, {
        duration: 3000,
      });
    } catch (error) {
      this.#logger.error('Error updating transaction:', error);

      // Show specific error message
      this.#snackBar.open(
        'Une erreur inattendue est survenue. Veuillez réessayer.',
        'Fermer',
        {
          duration: 5000,
        },
      );
    }
  }
}
