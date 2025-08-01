import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
  effect,
  Injector,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BaseLoadingComponent } from '../../../ui/loading';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
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
import { map } from 'rxjs/operators';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { TemplateLine } from '@pulpe/shared';
import { Title } from '@core/routing';

@Component({
  selector: 'pulpe-template-detail',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    FinancialSummary,
    TransactionsTable,
    BaseLoadingComponent,
  ],
  template: `
    <!-- Main container with proper surface container background -->
    <div class="flex flex-col gap-6 h-full p-4 md:p-6">
      @switch (true) {
        @case (data.status() === 'loading' || data.status() === 'reloading') {
          <!-- Loading state with proper accessibility -->
          <pulpe-base-loading
            message="Chargement des détails du modèle..."
            size="large"
            [fullHeight]="true"
            surface="surface-container"
            testId="template-details-loading"
          ></pulpe-base-loading>
        }
        @case (data.status() === 'error') {
          <!-- Error state with proper ARIA roles -->
          <div
            class="flex justify-center items-center h-full bg-error rounded-xl p-6"
            role="alert"
            aria-live="assertive"
          >
            <div class="text-center">
              <mat-icon class="mb-4 !text-4xl" aria-hidden="true">
                error_outline
              </mat-icon>
              <p class="text-body-large">
                Une erreur est survenue lors du chargement des détails du
                modèle.
              </p>
              <button
                mat-stroked-button
                (click)="data.reload()"
                class="mt-4"
                aria-label="Réessayer le chargement"
              >
                Réessayer
              </button>
            </div>
          </div>
        }
        @case (data.status() === 'resolved' || data.status() === 'local') {
          @if (data.value(); as value) {
            <!-- Header section with proper semantic structure -->
            <header
              class="flex flex-shrink-0 gap-4 items-center rounded-xl p-4"
            >
              <button
                mat-icon-button
                (click)="navigateBack()"
                aria-label="Retour à la liste des modèles"
                class="flex-shrink-0"
              >
                <mat-icon>arrow_back</mat-icon>
              </button>
              <div class="flex-1 min-w-0">
                <h1
                  class="text-display-small truncate"
                  [title]="value.template.name"
                >
                  {{ value.template.name }}
                </h1>
              </div>
            </header>

            <!-- Financial summary cards with responsive grid -->
            <section
              class="flex-shrink-0"
              aria-labelledby="financial-summary-heading"
            >
              <h2 id="financial-summary-heading" class="sr-only">
                Résumé financier du modèle
              </h2>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <pulpe-financial-summary
                  [data]="incomeData()"
                  role="region"
                  [attr.aria-label]="
                    'Revenus: ' +
                    (incomeData().amount
                      | currency: 'CHF' : 'symbol' : '1.0-2' : 'fr-CH')
                  "
                />
                <pulpe-financial-summary
                  [data]="expenseData()"
                  role="region"
                  [attr.aria-label]="
                    'Dépenses: ' +
                    (expenseData().amount
                      | currency: 'CHF' : 'symbol' : '1.0-2' : 'fr-CH')
                  "
                />
                <pulpe-financial-summary
                  [data]="savingsData()"
                  role="region"
                  [attr.aria-label]="
                    'Économies: ' +
                    (savingsData().amount
                      | currency: 'CHF' : 'symbol' : '1.0-2' : 'fr-CH')
                  "
                />
                <pulpe-financial-summary
                  [data]="netBalanceData()"
                  role="region"
                  [attr.aria-label]="
                    netBalanceData().title +
                    ': ' +
                    (netBalanceData().amount
                      | currency: 'CHF' : 'symbol' : '1.0-2' : 'fr-CH')
                  "
                />
              </div>
            </section>

            <!-- Transactions section with proper surface container -->
            <section
              class="flex flex-col flex-1 gap-4 min-h-0 rounded-xl p-4"
              aria-labelledby="transactions-heading"
            >
              <div class="flex gap-4 justify-between items-center">
                <h2
                  id="transactions-heading"
                  class="flex-shrink-0 text-headline-small"
                >
                  Transactions fixes
                </h2>
                <button
                  mat-icon-button
                  [matMenuTriggerFor]="transactionsMenu"
                  aria-label="Options pour les transactions"
                  aria-haspopup="menu"
                  [attr.aria-expanded]="false"
                >
                  <mat-icon>more_vert</mat-icon>
                </button>

                <mat-menu
                  #transactionsMenu="matMenu"
                  aria-label="Menu des options"
                >
                  <button
                    mat-menu-item
                    (click)="editTemplate()"
                    aria-label="Éditer les transactions du modèle"
                  >
                    <mat-icon aria-hidden="true">edit</mat-icon>
                    <span>Éditer</span>
                  </button>
                </mat-menu>
              </div>

              <div class="flex-1 min-h-0 rounded-lg">
                <pulpe-transactions-table
                  class="flex-1 min-h-0"
                  [entries]="entries()"
                  role="table"
                  aria-label="Liste des transactions fixes du modèle"
                />
              </div>
            </section>
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
  #route = inject(ActivatedRoute);
  #budgetTemplatesApi = inject(BudgetTemplatesApi);
  #title = inject(Title);
  #dialog = inject(MatDialog);
  #injector = inject(Injector);
  #breakpointObserver = inject(BreakpointObserver);

  templateId = input.required<string>();

  data = resource({
    params: () => this.templateId(),
    loader: async ({ params }) =>
      firstValueFrom(this.#budgetTemplatesApi.getDetail$(params)),
  });

  // Reactive breakpoint detection with proper signal integration
  isHandset = toSignal(
    this.#breakpointObserver
      .observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  entries = computed<FinancialEntry[]>(() => {
    const value = this.data.value();
    if (!value) {
      return [];
    }
    return value.transactions.map((transaction: TemplateLine) => {
      const spent =
        transaction.kind === 'FIXED_EXPENSE' ? transaction.amount : 0;
      const earned = transaction.kind === 'INCOME' ? transaction.amount : 0;
      const saved =
        transaction.kind === 'SAVINGS_CONTRIBUTION' ? transaction.amount : 0;
      return {
        description: transaction.name,
        spent,
        earned,
        saved,
        total: earned - spent,
      };
    });
  });

  // Optimized: Single pass through entries for all totals
  #totals = computed(() => {
    return this.entries().reduce(
      (acc, entry) => ({
        income: acc.income + entry.earned,
        expense: acc.expense + entry.spent,
        savings: acc.savings + entry.saved,
      }),
      { income: 0, expense: 0, savings: 0 },
    );
  });

  incomeData = computed<FinancialSummaryData>(() => ({
    title: 'Revenus',
    amount: this.#totals().income,
    icon: 'trending_up',
    type: 'income',
    isClickable: false,
  }));

  expenseData = computed<FinancialSummaryData>(() => ({
    title: 'Dépenses',
    amount: this.#totals().expense,
    icon: 'trending_down',
    type: 'expense',
  }));

  savingsData = computed<FinancialSummaryData>(() => ({
    title: 'Économies',
    amount: this.#totals().savings,
    icon: 'savings',
    type: 'savings',
  }));

  netBalanceData = computed<FinancialSummaryData>(() => {
    const totals = this.#totals();
    const total = totals.income - totals.expense;
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
    this.#router.navigate(['..'], { relativeTo: this.#route });
  }

  editTemplate() {
    const templateData = this.data.value();
    if (!templateData) {
      return;
    }

    const transactions = templateData.transactions.map(
      (transaction: TemplateLine) => ({
        description: transaction.name,
        amount: transaction.amount,
        type: transaction.kind,
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
      injector: this.#injector,
    });

    // Handle dialog closure with direct RxJS subscription (appropriate for one-time events)
    dialogRef.afterClosed().subscribe((dialogResult) => {
      if (dialogResult?.saved) {
        console.log('Transactions mises à jour:', dialogResult.transactions);
        // TODO: Appeler l'API pour sauvegarder les modifications et reload resource
        // this.#budgetTemplatesApi.updateTransactions(this.templateId(), dialogResult.transactions)
        //   .then(() => this.data.reload());
      }
    });
  }
}
