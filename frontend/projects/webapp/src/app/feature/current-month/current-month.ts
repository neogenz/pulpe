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
  MAT_FORM_FIELD_DEFAULT_OPTIONS,
  MatFormFieldModule,
} from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DashboardError } from './components/dashboard-error';
import { DashboardLoading } from './components/dashboard-loading';
import { FixedTransactionsList } from './components/fixed-transactions-list';
import {
  QuickAddExpenseForm,
  TransactionFormData,
} from './components/quick-add-expense-form';
import { VariableExpensesList } from './components/variable-expenses-list';
import { CurrentMonthState } from './services/current-month-state';
import { TransactionChipFilter } from './components/transaction-chip-filter';
import { Title } from '@core/routing';
import { BudgetProgressBar } from './components/budget-progress-bar';

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
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    FixedTransactionsList,
    DashboardError,
    DashboardLoading,
    VariableExpensesList,
    QuickAddExpenseForm,
    TransactionChipFilter,
  ],
  template: `
    <div
      class="flex flex-col 2xl:h-full gap-4 2xl:min-h-0"
      data-testid="current-month-page"
    >
      <header
        class="flex justify-between items-center"
        data-testid="page-header"
      >
        <h1 class="text-display-small" data-testid="page-title">
          {{ title.currentTitle() }}
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
          <pulpe-dashboard-loading data-testid="dashboard-loading" />
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
              [totalBudget]="state.incomeAmount()"
              [remainingAmount]="state.expenseAmount()"
            />
            <div
              class="flex flex-col 2xl:flex-row gap-4 2xl:min-h-0 2xl:flex-1"
              data-testid="dashboard-content"
            >
              <div class="flex-1 2xl:flex-[6] flex flex-col gap-4">
                <pulpe-quick-add-expense-form
                  (addTransaction)="onAddTransaction($event)"
                  data-testid="quick-add-expense-form"
                />
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
                <pulpe-variable-expenses-list
                  class="2xl:min-h-0 2xl:flex-1"
                  [transactions]="variableTransactions()"
                  [(selectedTransactions)]="selectedTransactions"
                  data-testid="variable-expenses-list"
                />
              </div>
              <div class="flex-1 2xl:flex-[4] 2xl:min-h-0">
                <pulpe-fixed-transactions-list
                  class="2xl:min-h-0 2xl:flex-1"
                  [transactions]="fixedTransactions()"
                  data-testid="fixed-transactions-list"
                />
              </div>
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
  `,
  styles: `
    :host {
      display: block;
      height: 100%;

      --mat-button-tonal-container-height: 32px;
      --mat-button-tonal-horizontal-padding: 12px;
      --mat-button-tonal-icon-spacing: 4px;
      --mat-button-tonal-icon-offset: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CurrentMonth implements OnInit {
  isCreatingTransaction = signal(false);
  selectedTransactions = signal<string[]>([]);
  protected readonly state = inject(CurrentMonthState);
  protected readonly title = inject(Title);
  fixedTransactions = computed(() => {
    const transactions = this.state.dashboardData.value()?.transactions ?? [];
    return transactions.filter(
      (transaction) => transaction.expenseType === 'fixed',
    );
  });
  variableTransactions = computed(() => {
    const transactions = this.state.dashboardData.value()?.transactions ?? [];
    return transactions.filter(
      (transaction) => transaction.expenseType === 'variable',
    );
  });

  ngOnInit() {
    this.state.refreshData();
  }

  async onAddTransaction(transaction: TransactionFormData) {
    try {
      this.isCreatingTransaction.set(true);
      await this.state.addTransaction({
        isRecurring: false,
        type: transaction.type,
        budgetId: this.state.dashboardData.value()?.budget?.id ?? '',
        amount: transaction.amount ?? 0,
        expenseType: 'variable',
        name: transaction.name,
        description: '',
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
