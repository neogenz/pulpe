import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
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
        @case (state.dashboardData.status() === 'resolved') {
          @if (state.dashboardData.value()?.budget) {
            <pulpe-financial-overview
              [incomeAmount]="state.incomeAmount()"
              [expenseAmount]="state.expenseAmount()"
              [savingsAmount]="state.savingsAmount()"
              [negativeAmount]="state.negativeAmount()"
            />
            <div class="flex gap-4">
              <div class="flex-[6]">
                <pulpe-quick-add-expense-form
                  (addTransaction)="onAddTransaction($event)"
                />
                <pulpe-variable-expenses-list />
              </div>
              <div class="flex-[4]">
                <pulpe-fixed-transactions-list
                  [transactions]="
                    state.dashboardData.value()?.transactions ?? []
                  "
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
  state = inject(CurrentMonthState);

  ngOnInit() {
    this.state.refreshData();
  }

  onAddTransaction(transaction: TransactionFormData) {
    console.log(transaction);
  }
}
