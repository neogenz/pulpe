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
import { FinancialOverview } from './components/financial-overview';
import { FixedTransactionsList } from './components/fixed-transactions-list';
import {
  QuickAddExpenseForm,
  TransactionFormData,
} from './components/quick-add-expense-form';
import { VariableExpensesList } from './components/variable-expenses-list';
import { CurrentMonthState } from './services/current-month-state';

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
    FinancialOverview,
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
  ],
  template: `
    <div class="flex flex-col h-full gap-4">
      <header class="flex justify-between items-center">
        <h1 class="text-display-small">Budget du mois courant</h1>
        <button
          matButton
          (click)="state.dashboardData.reload()"
          [disabled]="state.dashboardData.isLoading()"
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
          <pulpe-dashboard-loading />
        }
        @case (state.dashboardData.status() === 'error') {
          <pulpe-dashboard-error (reload)="state.dashboardData.reload()" />
        }
        @case (
          state.dashboardData.status() === 'resolved' ||
          state.dashboardData.status() === 'local'
        ) {
          @if (state.dashboardData.value()?.budget) {
            <pulpe-financial-overview
              [incomeAmount]="state.incomeAmount()"
              [expenseAmount]="state.expenseAmount()"
              [savingsAmount]="state.savingsAmount()"
              [negativeAmount]="state.negativeAmount()"
            />
            <div class="flex gap-4 min-h-0">
              <div class="flex-[6] flex flex-col">
                <pulpe-quick-add-expense-form
                  (addTransaction)="onAddTransaction($event)"
                />
                <pulpe-variable-expenses-list
                  class="min-h-0"
                  [transactions]="variableTransactions()"
                />
              </div>
              <div class="flex-[4] min-h-0">
                <pulpe-fixed-transactions-list
                  [transactions]="fixedTransactions()"
                />
              </div>
            </div>
          } @else {
            <div class="empty-state">
              <h2 class="text-title-large mt-4">Aucun budget trouvé</h2>
              <p class="text-body-large text-on-surface-variant mt-2">
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
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CurrentMonth implements OnInit {
  isCreatingTransaction = signal(false);
  state = inject(CurrentMonthState);
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
        type: 'expense',
        budgetId: this.state.dashboardData.value()?.budget?.id ?? '',
        amount: transaction.amount ?? 0,
        expenseType: 'variable',
        name: transaction.name,
        description: null,
      });
    } catch (error) {
      console.error(error);
    } finally {
      this.isCreatingTransaction.set(false);
    }
  }
}
