import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
  effect,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import {
  FinancialSummaryData,
  FinancialSummary,
} from '@ui/financial-summary/financial-summary';
import {
  TransactionsTable,
  FinancialEntry,
  EditTransactionsDialog,
} from './components';
import { BudgetTemplatesApi } from '../services/budget-templates-api';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { TemplateTransaction } from '@pulpe/shared';
import { Title } from '@core/routing';

@Component({
  selector: 'pulpe-template-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatMenuModule,
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
            <header class="flex flex-shrink-0 gap-4 items-center">
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

            <div
              class="grid flex-shrink-0 grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4 md:my-8"
            >
              <pulpe-financial-summary [data]="incomeData()" />
              <pulpe-financial-summary [data]="expenseData()" />
              <pulpe-financial-summary [data]="savingsData()" />
              <pulpe-financial-summary [data]="netBalanceData()" />
            </div>

            <div class="flex flex-col flex-1 gap-4 min-h-0">
              <div class="flex gap-4 justify-between items-center">
                <h2 class="flex-shrink-0 text-headline-small">
                  Transactions fixes
                </h2>
                <button
                  mat-icon-button
                  [matMenuTriggerFor]="transactionsMenu"
                  aria-label="Options des transactions"
                >
                  <mat-icon>more_vert</mat-icon>
                </button>

                <mat-menu #transactionsMenu="matMenu">
                  <button mat-menu-item (click)="editTemplate()">
                    <mat-icon>edit</mat-icon>
                    <span>Éditer</span>
                  </button>
                </mat-menu>
              </div>
              <pulpe-transactions-table
                class="flex-1 min-h-0"
                [entries]="entries()"
              />
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
  #title = inject(Title);
  #dialog = inject(MatDialog);

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
    return value.transactions.map((transaction: TemplateTransaction) => {
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

  constructor() {
    // Mettre à jour le titre de la page avec le nom du modèle
    effect(() => {
      const value = this.data.value();
      if (value && value.template.name) {
        this.#title.setTitle(value.template.name);
      }
    });
  }

  navigateBack() {
    this.#router.navigate(['..']);
  }

  editTemplate() {
    const templateData = this.data.value();
    if (!templateData) {
      return;
    }

    const transactions = templateData.transactions.map(
      (transaction: TemplateTransaction) => ({
        description: transaction.name,
        amount: transaction.amount,
        type: transaction.type as 'INCOME' | 'EXPENSE' | 'SAVING',
      }),
    );

    const dialogRef = this.#dialog.open(EditTransactionsDialog, {
      data: {
        transactions,
        templateName: templateData.template.name,
      },
      width: '90vw',
      maxWidth: '1200px',
      height: '90vh',
      maxHeight: '90vh',
      disableClose: true,
      autoFocus: true,
      restoreFocus: true,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result?.saved) {
        console.log('Transactions mises à jour:', result.transactions);
        // TODO: Appeler l'API pour sauvegarder les modifications
        // this.#budgetTemplatesApi.updateTransactions(this.templateId(), result.transactions);
      }
    });
  }
}
