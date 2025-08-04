import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import {
  MatBottomSheet,
  MatBottomSheetModule,
} from '@angular/material/bottom-sheet';
import {
  MAT_FORM_FIELD_DEFAULT_OPTIONS,
  MatFormFieldModule,
} from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DashboardError } from './components/dashboard-error';
import { BaseLoadingComponent } from '../../ui/loading';
import { FixedTransactionsList } from './components/fixed-transactions-list';
import { VariableExpensesList } from './components/variable-expenses-list';
import { CurrentMonthState } from './services/current-month-state';
import { TransactionChipFilter } from './components/transaction-chip-filter';
import { TitleDisplayService } from '@core/routing/title-display.service';
import { BudgetProgressBar } from './components/budget-progress-bar';
import {
  AddTransactionBottomSheet,
  TransactionFormData,
} from './components/add-transaction-bottom-sheet';
import { BudgetLineMapper } from './services/budget-line-mapper';

@Component({
  selector: 'pulpe-current-month',
  providers: [
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: {
        appearance: 'outline',
      },
    },
    BudgetLineMapper,
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
    FixedTransactionsList,
    DashboardError,
    BaseLoadingComponent,
    VariableExpensesList,
    TransactionChipFilter,
  ],
  template: `
    <div class="flex flex-col gap-4" data-testid="current-month-page">
      <header
        class="flex justify-between items-center"
        data-testid="page-header"
      >
        <h1 class="text-display-small" data-testid="page-title">
          {{ titleDisplay.currentTitle() }}
        </h1>
        <button
          matButton
          (click)="state.dashboardData.reload()"
          [disabled]="state.dashboardData.isLoading()"
          data-testid="refresh-button"
        >
          <mat-icon>refresh</mat-icon>
          Actualiser
        </button>
      </header>
      {{ state.dashboardData.status() }}

      @switch (true) {
        @case (
          state.dashboardData.status() === 'loading' ||
          state.dashboardData.status() === 'reloading'
        ) {
          <pulpe-base-loading
            message="Chargement du tableau de bord..."
            size="large"
            testId="dashboard-loading"
          />
        }
        @case (state.dashboardData.status() === 'error') {
          <pulpe-dashboard-error
            (reload)="state.dashboardData.reload()"
            data-testid="dashboard-error"
          />
        }
        @case (
          state.dashboardData.status() === 'resolved' ||
          state.dashboardData.status() === 'local'
        ) {
          @if (state.dashboardData.value()?.budget) {
            <pulpe-budget-progress-bar
              [totalBudget]="state.livingAllowanceAmount()"
              [usedAmount]="state.actualTransactionsAmount()"
            />
            <div class="flex flex-col gap-4" data-testid="dashboard-content">
              <pulpe-transaction-chip-filter
                data-testid="transaction-chip-filter"
              />
              @if (selectedTransactions().length > 0) {
                <div class="flex gap-4" data-testid="bulk-actions">
                  <button
                    matButton="tonal"
                    (click)="deleteSelectedTransactions()"
                    data-testid="delete-selected-button"
                  >
                    <mat-icon>delete_sweep</mat-icon>
                    Supprimer ({{ selectedTransactions().length }})
                  </button>
                  <button
                    matButton="tonal"
                    (click)="editSelectedTransactions()"
                    data-testid="merge-selected-button"
                  >
                    <mat-icon>call_merge</mat-icon>
                    Fusionner ({{ selectedTransactions().length }})
                  </button>
                </div>
              }
              <pulpe-fixed-transactions-list
                [transactions]="fixedTransactions()"
                data-testid="fixed-transactions-list"
              />
              <pulpe-variable-expenses-list
                [transactions]="variableTransactions()"
                [(selectedTransactions)]="selectedTransactions"
                data-testid="variable-expenses-list"
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
                {{ state.today() | date: 'MMMM yyyy' }}.
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
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.24);
    }

    :host ::ng-deep .add-transaction-bottom-sheet {
      .mat-mdc-bottom-sheet-container {
        border-radius: 16px 16px 0 0;
        max-height: 80vh;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CurrentMonth implements OnInit {
  isCreatingTransaction = signal(false);
  selectedTransactions = signal<string[]>([]);
  protected readonly state = inject(CurrentMonthState);
  protected readonly titleDisplay = inject(TitleDisplayService);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly budgetLineMapper = inject(BudgetLineMapper);

  fixedTransactions = computed(() => {
    const budgetLines = this.state.budgetLines();
    const budgetId = this.state.dashboardData.value()?.budget?.id;

    if (!budgetId) return [];

    // Filter budget lines with 'fixed' recurrence and map them to Transaction-like objects
    return budgetLines
      .filter((line) => line.recurrence === 'fixed')
      .map((line) => this.budgetLineMapper.toTransaction(line, budgetId));
  });
  variableTransactions = computed(() => {
    // For now, show all transactions as variable expenses
    const transactions = this.state.dashboardData.value()?.transactions ?? [];
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
  ngOnInit() {
    this.state.refreshData();

    // Désactiver temporairement l'ouverture automatique pour éviter les interférences avec les tests E2E
    // setTimeout(() => {
    //   this.openAddTransactionBottomSheet();
    // }, 300);
  }

  /**
   *
   */
  openAddTransactionBottomSheet(): void {
    const bottomSheetRef = this.bottomSheet.open(AddTransactionBottomSheet, {
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
      await this.state.addTransaction({
        budgetId: this.state.dashboardData.value()?.budget?.id ?? '',
        amount: transaction.amount ?? 0,
        name: transaction.name,
        kind:
          transaction.type === 'income'
            ? 'INCOME'
            : transaction.type === 'saving'
              ? 'SAVINGS_CONTRIBUTION'
              : 'FIXED_EXPENSE',
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

  deleteSelectedTransactions(): void {
    const selectedIds = this.selectedTransactions();
    console.log('Supprimer les transactions:', selectedIds);
    // TODO: Implémenter la suppression des transactions
    this.selectedTransactions.set([]);
  }

  editSelectedTransactions(): void {
    const selectedIds = this.selectedTransactions();
    console.log('Modifier les transactions:', selectedIds);
    // TODO: Implémenter la modification des transactions
  }
}
