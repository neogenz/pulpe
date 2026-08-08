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
  type SavingsGoalPlannedWithdrawal,
  type SavingsGoalPlanOnlyWithdrawal,
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
      } @else if (
        withdrawals().length === 0 &&
        plannedWithdrawals().length === 0 &&
        planOnlyWithdrawals().length === 0
      ) {
        <p
          class="text-body-small text-on-surface-variant"
          data-testid="goal-withdrawals-empty"
        >
          {{ 'savingsGoals.detail.withdrawalsEmpty' | transloco }}
        </p>
      } @else {
        @if (
          plannedWithdrawals().length > 0 || planOnlyWithdrawals().length > 0
        ) {
          <section class="flex flex-col gap-2">
            <h3 class="text-title-medium font-medium">
              {{ 'savingsGoals.detail.plannedWithdrawalsTitle' | transloco }}
            </h3>
            <ul class="flex flex-col gap-2">
              @for (w of planOnlyWithdrawals(); track w.planWithdrawalId) {
                <li
                  class="flex items-center gap-3 rounded-xl bg-surface-container-low p-4"
                  data-testid="savings-goal-plan-only-withdrawal-row"
                >
                  <mat-icon
                    class="shrink-0 text-on-surface-variant"
                    aria-hidden="true"
                    >event_note</mat-icon
                  >
                  <div class="flex min-w-0 flex-1 flex-col">
                    <span class="text-body-large truncate ph-no-capture">{{
                      w.name
                    }}</span>
                    <span class="text-body-small text-on-surface-variant">
                      {{ plannedDate(w) | date: 'MMMM y' }} ·
                      {{
                        'savingsGoals.detail.withdrawalPlanOnlyOrigin'
                          | transloco
                      }}
                    </span>
                  </div>
                  <span
                    class="text-body-large font-medium tabular-nums ph-no-capture"
                  >
                    {{ -w.plannedAmount | appCurrency: currency() : '1.2-2' }}
                  </span>
                </li>
              }
              @for (w of plannedWithdrawals(); track w.budgetLineId) {
                <li>
                  <a
                    class="flex items-center gap-3 rounded-xl bg-surface-container-low p-4 no-underline text-on-surface hover:bg-surface-container"
                    [routerLink]="['/budget', w.budgetId]"
                    [attr.aria-label]="
                      'savingsGoals.detail.withdrawalOpenAria'
                        | transloco: { name: w.name }
                    "
                    data-testid="savings-goal-planned-withdrawal-row"
                  >
                    <mat-icon
                      class="shrink-0 text-on-surface-variant"
                      aria-hidden="true"
                      >schedule</mat-icon
                    >
                    <div class="flex min-w-0 flex-1 flex-col">
                      <span class="text-body-large truncate ph-no-capture">{{
                        w.name
                      }}</span>
                      <span class="text-body-small text-on-surface-variant">
                        {{ plannedDate(w) | date: 'MMMM y' }} ·
                        @if (w.status === 'realized') {
                          {{ 'budgetLine.withdrawalRealized' | transloco }}
                        } @else if (w.status === 'partially_realized') {
                          {{
                            'savingsGoals.detail.withdrawalPartiallyRealized'
                              | transloco
                          }}
                        } @else {
                          {{
                            'savingsGoals.detail.withdrawalToRealize'
                              | transloco
                          }}
                        }
                      </span>
                      @if (w.status === 'partially_realized') {
                        <span
                          class="text-body-small text-on-surface-variant ph-no-capture"
                        >
                          {{
                            'savingsGoals.detail.withdrawalRemaining'
                              | transloco
                          }}
                          {{
                            -w.remainingAmount
                              | appCurrency: currency() : '1.2-2'
                          }}
                        </span>
                      }
                    </div>
                    <span
                      class="text-body-large font-medium tabular-nums ph-no-capture"
                    >
                      {{ -w.plannedAmount | appCurrency: currency() : '1.2-2' }}
                    </span>
                    <mat-icon
                      class="shrink-0 text-on-surface-variant"
                      aria-hidden="true"
                      >chevron_right</mat-icon
                    >
                  </a>
                </li>
              }
            </ul>
          </section>
        }

        @if (withdrawals().length > 0) {
          <section class="flex flex-col gap-2">
            <h3 class="text-title-medium font-medium">
              {{ 'savingsGoals.detail.realizedWithdrawalsTitle' | transloco }}
            </h3>
            <ul class="flex flex-col gap-2">
              @for (w of withdrawals(); track w.transactionId) {
                <li>
                  <a
                    class="flex items-center gap-3 rounded-xl bg-surface-container-low p-4 no-underline text-on-surface hover:bg-surface-container"
                    [routerLink]="['/budget', w.budgetId]"
                    [attr.aria-label]="
                      'savingsGoals.detail.withdrawalOpenAria'
                        | transloco: { name: w.name }
                    "
                    data-testid="savings-goal-withdrawal-row"
                  >
                    <mat-icon
                      class="shrink-0 text-on-surface-variant"
                      aria-hidden="true"
                      >call_made</mat-icon
                    >
                    <div class="flex min-w-0 flex-1 flex-col">
                      <span class="text-body-large truncate ph-no-capture">{{
                        w.name
                      }}</span>
                      <span class="text-body-small text-on-surface-variant">
                        {{ w.transactionDate | date: shortDateFormat() }} ·
                        {{
                          (w.checkedAt
                            ? 'savingsGoals.detail.withdrawalChecked'
                            : 'savingsGoals.detail.withdrawalUnchecked'
                          ) | transloco
                        }}
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
                      >chevron_right</mat-icon
                    >
                  </a>
                </li>
              }
            </ul>
          </section>
        }
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
  readonly plannedWithdrawals = input<SavingsGoalPlannedWithdrawal[]>([]);
  readonly planOnlyWithdrawals = input<SavingsGoalPlanOnlyWithdrawal[]>([]);
  readonly currency = input.required<SupportedCurrency>();
  readonly isLoading = input(false);
  readonly hasError = input(false);

  protected readonly shortDateFormat = computed(
    () => getDateDisplayFormats(this.currency()).shortDate,
  );

  protected plannedDate(withdrawal: { month: number; year: number }): Date {
    return new Date(withdrawal.year, withdrawal.month - 1, 1);
  }
}
