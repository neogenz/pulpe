import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  type OnInit,
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
import { DashboardError } from './components/dashboard-error';
import { BaseLoading } from '@ui/loading';
import { RecurringExpensesList } from './components/recurring-expenses-list';
import { OneTimeExpensesList } from './components/one-time-expenses-list';
import { CurrentMonthStore } from './services/current-month-store';
import { TitleDisplay } from '@core/routing';
import { BudgetProgressBar } from './components/budget-progress-bar';
import { AddTransactionBottomSheet } from './components/add-transaction-bottom-sheet';
import { mapBudgetLineToFinancialEntry } from './utils/financial-entry-mapper';
import { ConfirmationDialog } from '@ui/dialogs/confirmation-dialog';
import { firstValueFrom } from 'rxjs';
import { type Transaction, type TransactionCreate } from '@pulpe/shared';
import { EditTransactionDialog } from './components/edit-transaction-dialog';

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
        <button
          matButton
          (click)="store.refreshData()"
          [disabled]="store.dashboardStatus() === 'loading'"
          data-testid="refresh-button"
        >
          <mat-icon>refresh</mat-icon>
          Actualiser
        </button>
      </header>

      @switch (true) {
        @case (
          store.dashboardStatus() === 'loading' ||
          store.dashboardStatus() === 'reloading'
        ) {
          <pulpe-base-loading
            message="Chargement du tableau de bord..."
            size="large"
            testId="dashboard-loading"
          />
        }
        @case (store.dashboardStatus() === 'error') {
          <pulpe-dashboard-error
            (reload)="store.refreshData()"
            data-testid="dashboard-error"
          />
        }
        @case (
          store.dashboardStatus() === 'resolved' ||
          store.dashboardStatus() === 'local'
        ) {
          @if (store.dashboardData()?.budget) {
            <pulpe-budget-progress-bar
              [expenses]="store.totalSpentWithoutRollover()"
              [available]="store.totalAvailableWithRollover()"
              [availableLimit]="store.totalAvailableWithRollover()"
            />
            <div class="flex flex-col gap-4" data-testid="dashboard-content">
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
                [transactions]="fixedTransactions()"
                data-testid="recurring-expenses-list"
              />
              <pulpe-one-time-expenses-list
                [transactions]="variableTransactions()"
                [(selectedTransactions)]="selectedTransactions"
                (deleteTransaction)="deleteTransaction($event)"
                (editTransaction)="openEditTransactionDialogAndUpdate($event)"
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
      }
    </div>

    <!-- FAB pour ajouter une transaction -->
    <button
      matFab
      (click)="openAddTransactionBottomSheet()"
      class="fab-button"
      aria-label="Ajouter une transaction"
      data-testid="add-transaction-fab"
    >
      <mat-icon>add</mat-icon>
    </button>
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      min-height: 100vh;

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
export default class CurrentMonth implements OnInit {
  isCreatingTransaction = signal(false);
  selectedTransactions = signal<string[]>([]);
  protected readonly store = inject(CurrentMonthStore);
  protected readonly titleDisplay = inject(TitleDisplay);
  #bottomSheet = inject(MatBottomSheet);
  #dialog = inject(MatDialog);
  #snackBar = inject(MatSnackBar);

  fixedTransactions = computed(() => {
    const budgetLines = this.store.budgetLines();
    const budgetId = this.store.dashboardData()?.budget?.id;

    if (!budgetId) return [];

    // Filter budget lines with 'fixed' or 'one_off' recurrence (Fixed Block) and map them to Transaction-like objects
    return budgetLines
      .filter(
        (line) => line.recurrence === 'fixed' || line.recurrence === 'one_off',
      )
      .map((line) => mapBudgetLineToFinancialEntry(line, budgetId));
  });
  variableTransactions = computed(() => {
    // For now, show all transactions as variable expenses
    const transactions = this.store.dashboardData()?.transactions ?? [];
    return transactions;
  });

  /**
   * [FEATURE MÉTIER TEMPORAIRE]
   * Ouvre automatiquement le bottom sheet "Ajouter une transaction" à chaque chargement de la page du mois courant,
   * après un délai de 300ms. Ce comportement est volontaire pour le moment: il s'agit d'une exigence métier temporaire
   * visant à encourager l'utilisateur à saisir sa première transaction dès l'arrivée sur la page.
   *
   * À retirer ou à conditionner dès que l'on implémente une UX plus évoluée (ex: onboarding, flag utilisateur, etc.).
   *
   * [TEMPORAIREMENT DÉSACTIVÉ POUR LES TESTS E2E]
   */
  // eslint-disable-next-line @angular-eslint/no-empty-lifecycle-method
  ngOnInit() {
    // Désactiver temporairement l'ouverture automatique pour éviter les interférences avec les tests E2E
    // setTimeout(() => {
    //   this.openAddTransactionBottomSheet();
    // }, 300);
  }

  /**
   *
   */
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
        isOutOfBudget: false,
        category: transaction.category ?? null,
      });
    } catch (error) {
      console.error(error);
    } finally {
      this.isCreatingTransaction.set(false);
    }
  }

  async deleteTransaction(transactionId: string): Promise<void> {
    // Find transaction for the confirmation dialog
    const transaction = this.variableTransactions().find(
      (t: Transaction) => t.id === transactionId,
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
        console.error('Error deleting transaction:', error);

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
    const transaction = this.variableTransactions().find(
      (transaction) => transaction.id === transactionId,
    );

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
      console.error('Error updating transaction:', error);

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
