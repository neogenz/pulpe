import { DatePipe, formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  compareBudgetPeriods,
  type SavingsGoalPlannedWithdrawal,
  type SavingsGoalPlanOnlyWithdrawal,
  type SavingsGoalWithdrawal,
  type SupportedCurrency,
} from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';
import { getDateDisplayFormats } from '@core/date/date-display-formats';

interface PlannedWithdrawalRow {
  id: string;
  budgetId: string | null;
  name: string;
  month: number;
  year: number;
  plannedAmount: number;
  realizedAmount: number;
  remainingAmount: number;
  status: SavingsGoalPlannedWithdrawal['status'];
}

/**
 * PUL-329 — « Retraits », l'argent SORTI de l'objectif vers un budget.
 *
 * Volontairement séparé de « Ton suivi » : les contributions font monter le
 * stock, les retraits le font descendre. Les mélanger dans une même liste
 * obligerait à lire le signe de chaque ligne pour comprendre le sens. Le montant
 * porte donc son signe négatif, mais reste dans la couleur du texte courant :
 * un retrait est un choix assumé, pas une anomalie (RG-002, l'épargne n'alerte
 * jamais). Les prévisions sont regroupées par période ; l'historique des
 * Réels conserve l'ordre fourni par le serveur, du plus récent au plus ancien.
 */
@Component({
  selector: 'pulpe-goal-withdrawals-list',
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
    TranslocoPipe,
    AppCurrencyPipe,
  ],
  providers: [AppCurrencyPipe],
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
        <div
          role="alert"
          class="flex flex-wrap items-center gap-2 text-body-small text-on-surface-variant"
          data-testid="goal-withdrawals-error"
        >
          <span>{{ 'savingsGoals.detail.withdrawalsError' | transloco }}</span>
          <button
            matButton
            type="button"
            (click)="retryRequested.emit()"
            data-testid="goal-withdrawals-retry"
          >
            {{ 'savingsGoals.detail.withdrawalsRetry' | transloco }}
          </button>
        </div>
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
        @if (plannedRows().length > 0) {
          <section class="flex flex-col gap-2">
            <h3 class="text-title-medium font-medium">
              {{ 'savingsGoals.detail.plannedWithdrawalsTitle' | transloco }}
            </h3>
            <ul class="flex flex-col gap-2">
              @for (w of plannedRows(); track w.id) {
                @if (w.budgetId === null) {
                  <li
                    class="flex items-center gap-3 rounded-xl bg-surface-container-low p-4"
                    [attr.aria-label]="planOnlyWithdrawalAria(w)"
                    data-planned-withdrawal-row
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
                } @else {
                  <li>
                    <a
                      class="flex items-center gap-3 rounded-xl bg-surface-container-low p-4 no-underline text-on-surface hover:bg-surface-container"
                      [routerLink]="['/budget', w.budgetId]"
                      [attr.aria-label]="linkedWithdrawalAria(w)"
                      data-planned-withdrawal-row
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
                          {{ withdrawalStatusKey(w.status) | transloco }}
                        </span>
                        <span
                          class="text-body-small text-on-surface-variant ph-no-capture"
                        >
                          {{
                            'savingsGoals.detail.withdrawalPlanned' | transloco
                          }}
                          {{
                            w.plannedAmount | appCurrency: currency() : '1.2-2'
                          }}
                          ·
                          {{
                            'savingsGoals.detail.withdrawalRealized' | transloco
                          }}
                          {{
                            w.realizedAmount | appCurrency: currency() : '1.2-2'
                          }}
                        </span>
                      </div>
                      @if (w.status === 'partially_realized') {
                        <span
                          class="flex shrink-0 flex-col items-end text-body-large font-medium tabular-nums ph-no-capture"
                        >
                          {{
                            -w.remainingAmount
                              | appCurrency: currency() : '1.2-2'
                          }}
                          <span
                            class="text-body-small font-normal text-on-surface-variant"
                          >
                            {{
                              'savingsGoals.detail.withdrawalRemainingLabel'
                                | transloco
                            }}
                          </span>
                        </span>
                      } @else {
                        <span
                          class="shrink-0 text-body-large font-medium tabular-nums ph-no-capture"
                        >
                          {{
                            -w.plannedAmount | appCurrency: currency() : '1.2-2'
                          }}
                        </span>
                      }
                      <mat-icon
                        class="shrink-0 text-on-surface-variant"
                        aria-hidden="true"
                        >chevron_right</mat-icon
                      >
                    </a>
                  </li>
                }
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
                    [attr.aria-label]="realizedWithdrawalAria(w)"
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
  readonly retryRequested = output<void>();

  readonly #locale = inject(LOCALE_ID);
  readonly #transloco = inject(TranslocoService);
  readonly #currencyPipe = inject(AppCurrencyPipe);

  protected readonly plannedRows = computed<PlannedWithdrawalRow[]>(() =>
    [
      ...this.planOnlyWithdrawals().map((withdrawal) => ({
        id: withdrawal.planWithdrawalId,
        budgetId: null,
        ...withdrawal,
        realizedAmount: 0,
        remainingAmount: withdrawal.plannedAmount,
        status: 'planned' as const,
      })),
      ...this.plannedWithdrawals().map((withdrawal) => ({
        id: withdrawal.budgetLineId,
        ...withdrawal,
      })),
    ].sort((a, b) => compareBudgetPeriods(a, b)),
  );

  protected readonly shortDateFormat = computed(
    () => getDateDisplayFormats(this.currency()).shortDate,
  );

  protected plannedDate(withdrawal: { month: number; year: number }): Date {
    return new Date(withdrawal.year, withdrawal.month - 1, 1);
  }

  protected withdrawalStatusKey(
    status: SavingsGoalPlannedWithdrawal['status'],
  ): string {
    if (status === 'realized') return 'budgetLine.withdrawalRealized';
    if (status === 'partially_realized')
      return 'savingsGoals.detail.withdrawalPartiallyRealized';
    return 'savingsGoals.detail.withdrawalToRealize';
  }

  protected planOnlyWithdrawalAria(withdrawal: PlannedWithdrawalRow): string {
    return this.#transloco.translate(
      'savingsGoals.detail.withdrawalPlanOnlyAria',
      {
        name: withdrawal.name,
        period: this.#formatPeriod(withdrawal),
        planned: this.#formatCurrency(withdrawal.plannedAmount),
      },
    );
  }

  protected linkedWithdrawalAria(withdrawal: PlannedWithdrawalRow): string {
    return this.#transloco.translate(
      'savingsGoals.detail.withdrawalLinkedAria',
      {
        name: withdrawal.name,
        period: this.#formatPeriod(withdrawal),
        status: this.#transloco.translate(
          this.withdrawalStatusKey(withdrawal.status),
        ),
        planned: this.#formatCurrency(withdrawal.plannedAmount),
        realized: this.#formatCurrency(withdrawal.realizedAmount),
        remaining: this.#formatCurrency(withdrawal.remainingAmount),
      },
    );
  }

  protected realizedWithdrawalAria(withdrawal: SavingsGoalWithdrawal): string {
    return this.#transloco.translate(
      'savingsGoals.detail.withdrawalRealizedAria',
      {
        name: withdrawal.name,
        date: formatDate(
          withdrawal.transactionDate,
          this.shortDateFormat(),
          this.#locale,
        ),
        status: this.#transloco.translate(
          withdrawal.checkedAt
            ? 'savingsGoals.detail.withdrawalChecked'
            : 'savingsGoals.detail.withdrawalUnchecked',
        ),
        amount: this.#formatCurrency(withdrawal.amount),
      },
    );
  }

  #formatPeriod(withdrawal: { month: number; year: number }): string {
    return formatDate(this.plannedDate(withdrawal), 'MMMM y', this.#locale);
  }

  #formatCurrency(amount: number): string {
    return this.#currencyPipe.transform(amount, this.currency(), '1.2-2') ?? '';
  }
}
