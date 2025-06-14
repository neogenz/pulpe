import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { FinancialOverview } from './components/financial-overview';
import { CurrentMonthState } from './current-month-state';

@Component({
  selector: 'pulpe-current-month',
  imports: [FinancialOverview, MatProgressSpinner, DatePipe],
  template: `
    <div class="space-y-6">
      <header class="flex justify-between items-center">
        <h1 class="text-display-small">Budget du mois courant</h1>
        @if (
          !currentMonthState.dashboardData.isLoading() &&
          currentMonthState.dashboardData.value()
        ) {
          <button
            (click)="currentMonthState.dashboardData.reload()"
            class="btn-secondary"
            [disabled]="currentMonthState.dashboardData.isLoading()"
          >
            <span class="material-icons">refresh</span>
            Actualiser
          </button>
        }
      </header>

      @switch (currentMonthState.dashboardData.status()) {
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
                {{ getErrorMessage(currentMonthState.dashboardData.error()) }}
              </p>
            </div>
            <button
              (click)="currentMonthState.dashboardData.reload()"
              class="btn-text"
            >
              Réessayer
            </button>
          </div>
        }
        @case ('resolved') {
          @if (currentMonthState.dashboardData.value()?.budget) {
            <pulpe-financial-overview
              [incomeAmount]="currentMonthState.incomeAmount()"
              [expenseAmount]="currentMonthState.expenseAmount()"
              [savingsAmount]="currentMonthState.savingsAmount()"
              [negativeAmount]="currentMonthState.negativeAmount()"
            />
          } @else {
            <div class="empty-state">
              <h2 class="text-title-large mt-4">Aucun budget trouvé</h2>
              <p class="text-body-large text-on-surface-variant mt-2">
                Aucun budget n'a été créé pour
                {{ currentMonthState.today() | date: 'MMMM yyyy' }}.
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
        @apply flex flex-col items-center justify-center py-8 text-center;
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
  currentMonthState = inject(CurrentMonthState);

  getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'object' && error !== null && 'message' in error) {
      return String(error.message);
    }
    return "Une erreur inattendue s'est produite. Veuillez réessayer.";
  }

  createBudget(): void {
    console.log('createBudget');
  }
}
