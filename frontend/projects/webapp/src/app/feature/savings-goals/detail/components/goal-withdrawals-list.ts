import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  type SavingsGoalWithdrawal,
  type SupportedCurrency,
} from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';
import { getDateDisplayFormats } from '@core/date/date-display-formats';

/**
 * PUL-329 — « Retraits », l'argent SORTI de l'objectif vers un budget.
 *
 * Volontairement séparé de « Ton suivi » : les contributions font monter le
 * stock, les retraits le font descendre. Les mélanger dans une même liste
 * obligerait à lire le signe de chaque ligne pour comprendre le sens. Le montant
 * porte donc son signe négatif, mais reste dans la couleur du texte courant :
 * un retrait est un choix assumé, pas une anomalie (RG-002, l'épargne n'alerte
 * jamais). Le serveur trie du plus récent au plus ancien ; on n'y retouche pas.
 */
@Component({
  selector: 'pulpe-goal-withdrawals-list',
  imports: [
    DatePipe,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
    TranslocoPipe,
    AppCurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex flex-col gap-3"
      data-testid="savings-goal-withdrawals-panel"
    >
      @if (isLoading()) {
        <div
          class="flex items-center gap-3 text-on-surface-variant"
          data-testid="goal-withdrawals-loading"
        >
          <mat-progress-spinner mode="indeterminate" [diameter]="20" />
          <span class="text-body-small">
            {{ 'savingsGoals.detail.withdrawalsLoading' | transloco }}
          </span>
        </div>
      } @else if (hasError()) {
        <p
          role="alert"
          class="text-body-small text-on-surface-variant"
          data-testid="goal-withdrawals-error"
        >
          {{ 'savingsGoals.detail.withdrawalsError' | transloco }}
        </p>
      } @else if (withdrawals().length === 0) {
        <p
          class="text-body-small text-on-surface-variant"
          data-testid="goal-withdrawals-empty"
        >
          {{ 'savingsGoals.detail.withdrawalsEmpty' | transloco }}
        </p>
      } @else {
        <ul class="flex flex-col gap-2">
          @for (w of withdrawals(); track w.transactionId) {
            <li>
              <a
                class="flex items-center gap-3 rounded-xl bg-surface-container-low p-4 no-underline text-on-surface hover:bg-surface-container"
                [routerLink]="['/budget', w.budgetId]"
                [queryParams]="{ transactionId: w.transactionId }"
                [attr.aria-label]="
                  'savingsGoals.detail.withdrawalOpenAria'
                    | transloco: { name: w.name }
                "
                data-testid="savings-goal-withdrawal-row"
              >
                <mat-icon
                  class="shrink-0 text-on-surface-variant"
                  aria-hidden="true"
                >
                  call_made
                </mat-icon>
                <div class="flex min-w-0 flex-1 flex-col">
                  <span class="text-body-large truncate ph-no-capture">{{
                    w.name
                  }}</span>
                  <span class="text-body-small text-on-surface-variant">
                    {{ w.transactionDate | date: shortDateFormat() }}
                  </span>
                </div>
                <span
                  class="text-body-large font-medium tabular-nums ph-no-capture"
                >
                  {{ -w.amount | appCurrency: currency() : '1.2-2' }}
                </span>
                <mat-icon
                  class="shrink-0 text-on-surface-variant"
                  aria-hidden="true"
                >
                  chevron_right
                </mat-icon>
              </a>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class GoalWithdrawalsList {
  readonly withdrawals = input.required<SavingsGoalWithdrawal[]>();
  readonly currency = input.required<SupportedCurrency>();
  readonly isLoading = input(false);
  readonly hasError = input(false);

  protected readonly shortDateFormat = computed(
    () => getDateDisplayFormats(this.currency()).shortDate,
  );
}
