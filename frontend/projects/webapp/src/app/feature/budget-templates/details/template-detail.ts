import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  FinancialSummaryData,
  FinancialSummary,
} from '@ui/financial-summary/financial-summary';
import {
  TransactionsTable,
  FinancialEntry,
} from './components/transactions-table';
import { BudgetTemplatesApi } from '../services/budget-templates-api';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'pulpe-template-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    FinancialSummary,
    TransactionsTable,
  ],
  template: `
    <div class="flex flex-col gap-4 h-full">
      @switch (true) {
        @case (data.status() === 'loading' || data.status() === 'reloading') {
          <div class="flex justify-center items-center h-full">
            <mat-spinner />
          </div>
        }
        @case (data.status() === 'error') {
          <div class="flex justify-center items-center h-full">
            <p class="text-error">
              Une erreur est survenue lors du chargement des détails du modèle.
            </p>
          </div>
        }
        @case (data.status() === 'resolved' || data.status() === 'local') {
          @if (data.value(); as value) {
            <header class="flex items-center gap-4">
              <button
                class="display-none"
                mat-icon-button
                (click)="navigateBack()"
                aria-label="Retour"
              >
                <mat-icon>arrow_back</mat-icon>
              </button>
              <h1 class="text-display-small">
                {{ value.template.name }}
              </h1>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4">
              <pulpe-financial-summary [data]="incomeData()" />
              <pulpe-financial-summary [data]="expenseData()" />
              <pulpe-financial-summary [data]="savingsData()" />
              <pulpe-financial-summary [data]="netBalanceData()" />
            </div>

            <div class="flex-1 overflow-auto">
              <pulpe-transactions-table [entries]="entries()" />
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
export default class TemplateDetail {
  #router = inject(Router);
  #budgetTemplatesApi = inject(BudgetTemplatesApi);

  templateId = input.required<string>();

  data = resource({
    params: () => this.templateId(),
    loader: async ({ params }) =>
      firstValueFrom(this.#budgetTemplatesApi.getDetail$(params)),
  });

  entries = computed<FinancialEntry[]>(() => {
    const value = this.data.value();
    if (!value) {
      return [];
    }
    return value.transactions.map((transaction) => {
      const spent =
        (transaction.type as string) === 'EXPENSE' ? transaction.amount : 0;
      const earned =
        (transaction.type as string) === 'INCOME' ? transaction.amount : 0;
      const saved =
        (transaction.type as string) === 'SAVING' ? transaction.amount : 0;
      return {
        description: transaction.name,
        spent,
        earned,
        saved,
        total: earned - spent,
      };
    });
  });

  incomeData = computed<FinancialSummaryData>(() => ({
    title: 'Revenus',
    amount: this.entries().reduce((acc, entry) => acc + entry.earned, 0),
    icon: 'trending_up',
    type: 'income',
    isClickable: false,
  }));

  expenseData = computed<FinancialSummaryData>(() => ({
    title: 'Dépenses',
    amount: this.entries().reduce((acc, entry) => acc + entry.spent, 0),
    icon: 'trending_down',
    type: 'expense',
  }));

  savingsData = computed<FinancialSummaryData>(() => ({
    title: 'Économies',
    amount: this.entries().reduce((acc, entry) => acc + entry.saved, 0),
    icon: 'savings',
    type: 'savings',
  }));

  netBalanceData = computed<FinancialSummaryData>(() => {
    const incomeAmount = Number(this.incomeData().amount);
    const expenseAmount = Number(this.expenseData().amount);
    const total = incomeAmount - expenseAmount;
    return {
      title: total >= 0 ? 'Solde net' : 'Déficit',
      amount: total,
      icon: total >= 0 ? 'account_balance_wallet' : 'money_off',
      type: total >= 0 ? 'income' : 'negative',
    };
  });

  navigateBack() {
    this.#router.navigate(['..']);
  }
}
