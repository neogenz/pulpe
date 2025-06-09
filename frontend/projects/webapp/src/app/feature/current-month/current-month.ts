import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { BudgetApi, BudgetCalculator } from '@core/budget';
import { TransactionApi } from '@core/transaction';
import {
  FinancialSummary,
  FinancialSummaryData,
} from '@ui/financial-summary/financial-summary';
import { format } from 'date-fns';
import { firstValueFrom } from 'rxjs';
import { type Budget, type Transaction } from '@pulpe/shared';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { DatePipe } from '@angular/common';
interface DashboardData {
  budget: Budget | null;
  transactions: Transaction[];
}
@Component({
  selector: 'pulpe-current-month',
  imports: [FinancialSummary, MatProgressSpinner, DatePipe],
  template: `
    <div class="space-y-6">
      <header class="flex justify-between items-center">
        <h1 class="text-display-small">Budget du mois courant</h1>
        @if (!dashboardData.isLoading() && dashboardData.value()) {
          <button
            (click)="dashboardData.reload()"
            class="btn-secondary"
            [disabled]="dashboardData.isLoading()"
          >
            <span class="material-icons">refresh</span>
            Actualiser
          </button>
        }
      </header>

      @switch (dashboardData.status()) {
        @case ('loading') {
          <div class="flex justify-center items-center h-64">
            <div
              class="text-center flex flex-col gap-4 justify-center items-center"
            >
              <mat-progress-spinner diameter="48" mode="indeterminate" />
              <p class="text-body-large text-on-surface-variant">
                Chargement du budget...
              </p>
            </div>
          </div>
        }
        @case ('error') {
          <div class="alert alert-error">
            <span class="material-icons">error</span>
            <div class="flex-1">
              <h3 class="text-title-medium">Erreur de chargement</h3>
              <p class="text-body-medium">
                {{ getErrorMessage(dashboardData.error()) }}
              </p>
            </div>
            <button (click)="dashboardData.reload()" class="btn-text">
              Réessayer
            </button>
          </div>
        }
        @case ('resolved') {
          @if (dashboardData.value()?.budget) {
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <pulpe-financial-summary
                [data]="incomeData()"
                (click)="onSummaryClick('income')"
              />
              <pulpe-financial-summary
                [data]="expenseData()"
                (click)="onSummaryClick('expense')"
              />
              <pulpe-financial-summary
                [data]="savingsData()"
                (click)="onSummaryClick('savings')"
              />
              <pulpe-financial-summary
                [data]="negativeData()"
                (click)="onSummaryClick('negative')"
              />
            </div>

            <!-- Section transactions récentes optionnelle -->
            @if (recentTransactions().length > 0) {
              <section class="mt-8">
                <h2 class="text-title-large mb-4">Transactions récentes</h2>
                <div class="space-y-2">
                  @for (
                    transaction of recentTransactions();
                    track transaction.id
                  ) {
                    <div class="transaction-item">
                      <!-- Afficher les détails de la transaction -->
                    </div>
                  }
                </div>
              </section>
            }
          } @else {
            <div class="empty-state">
              <h2 class="text-title-large mt-4">Aucun budget trouvé</h2>
              <p class="text-body-large text-on-surface-variant mt-2">
                Aucun budget n'a été créé pour
                {{ today() | date: 'MMMM yyyy' }}.
              </p>
            </div>
          }
        }
      }
    </div>
  `,
  styles: [
    `
      .empty-state {
        @apply flex flex-col items-center justify-center py-16 text-center;
      }

      .transaction-item {
        @apply p-4 bg-surface-container rounded-lg hover:bg-surface-container-high transition-colors;
      }

      .alert {
        @apply flex items-start gap-4 p-4 rounded-lg;
      }

      .alert-error {
        @apply bg-error-container text-on-error-container;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CurrentMonth {
  readonly #budgetApi = inject(BudgetApi);
  readonly #transactionApi = inject(TransactionApi);
  readonly #budgetCalculator = inject(BudgetCalculator);

  protected readonly today = signal<Date>(new Date());

  // Computed pour la date actuelle
  readonly #currentDate = computed(() => {
    const now = new Date();
    return {
      month: format(now, 'MM'),
      year: format(now, 'yyyy'),
      monthName: format(now, 'MMMM yyyy'),
    };
  });

  // Resource avec gestion d'erreur et rechargement
  protected readonly dashboardData = resource<
    DashboardData,
    { month: string; year: string }
  >({
    params: () => ({
      month: this.#currentDate().month,
      year: this.#currentDate().year,
    }),
    loader: async ({ params }) => {
      try {
        // Charger le budget
        const budget = await firstValueFrom(
          this.#budgetApi.getBudgetForMonth$(params.month, params.year),
        );

        if (!budget) {
          return { budget: null, transactions: [] };
        }

        // Charger les transactions si un budget existe
        const transactionResponse = await firstValueFrom(
          this.#transactionApi.findByBudget$(budget.id),
        );

        return {
          budget,
          transactions: transactionResponse.transactions || [],
        };
      } catch (error) {
        // Logger l'erreur pour le monitoring
        console.error('Erreur lors du chargement du dashboard:', error);
        throw error;
      }
    },
  });

  // Computed values avec gestion null-safe
  readonly #budget = computed(() => this.dashboardData.value()?.budget || null);
  readonly #transactions = computed(
    () => this.dashboardData.value()?.transactions || [],
  );

  // Transactions récentes (top 5)
  readonly recentTransactions = computed(() =>
    this.#transactions()
      .slice(0, 5)
      .sort(
        (a: Transaction, b: Transaction) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
  );

  // Financial summaries avec valeurs par défaut
  readonly incomeData = computed<FinancialSummaryData>(() => {
    const budget = this.#budget();
    const transactions = this.#transactions();
    return {
      title: 'Revenus',
      amount: budget
        ? this.#budgetCalculator.calculateTotalIncome(budget, transactions)
        : 0,
      icon: 'trending_up',
      type: 'income',
      isClickable: !!budget,
      trend: this.calculateTrend('income'),
    };
  });

  readonly expenseData = computed<FinancialSummaryData>(() => {
    const budget = this.#budget();
    const transactions = this.#transactions();
    return {
      title: 'Dépenses',
      amount: budget
        ? this.#budgetCalculator.calculateTotalExpenses(budget, transactions)
        : 0,
      icon: 'trending_down',
      type: 'expense',
      isClickable: !!budget,
      trend: this.calculateTrend('expense'),
    };
  });

  readonly savingsData = computed<FinancialSummaryData>(() => {
    const budget = this.#budget();
    const transactions = this.#transactions();
    return {
      title: 'Économies',
      amount: budget
        ? this.#budgetCalculator.calculateTotalSavings(budget, transactions)
        : 0,
      icon: 'savings',
      type: 'savings',
      isClickable: !!budget,
      trend: this.calculateTrend('savings'),
    };
  });

  readonly negativeData = computed<FinancialSummaryData>(() => {
    const budget = this.#budget();
    const transactions = this.#transactions();
    const amount = budget
      ? this.#budgetCalculator.calculateNegativeBudget(budget, transactions)
      : 0;
    return {
      title: amount < 0 ? 'Déficit' : 'Solde',
      amount: Math.abs(amount),
      icon: amount < 0 ? 'money_off' : 'account_balance',
      type: 'negative',
      isClickable: !!budget,
      isNegative: amount < 0,
    };
  });

  getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'object' && error !== null && 'message' in error) {
      return String(error.message);
    }
    return "Une erreur inattendue s'est produite. Veuillez réessayer.";
  }

  onSummaryClick(type: 'income' | 'expense' | 'savings' | 'negative'): void {
    console.log('onSummaryClick', type);
    if (!this.#budget()) return;
  }

  createBudget(): void {
    console.log('createBudget');
  }

  // Calcul de tendance (optionnel, pour enrichir l'UI)
  private calculateTrend(type: string): number | null {
    console.log('calculateTrend', type);
    return null;
  }
}
