import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  type SavingsGoalContribution,
  type SupportedCurrency,
} from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';
import { getDateDisplayFormats } from '@core/date/date-display-formats';

/**
 * « Ton suivi » (docs/SAVINGS_PLAN.md §3, dernier bloc). Extrait de la page
 * détail (plafond 300 lignes) : rend une contribution par ligne épargne liée,
 * avec ses transactions réelles imbriquées. Pure présentation, inputs only.
 */
@Component({
  selector: 'pulpe-goal-contributions-list',
  imports: [DatePipe, MatIconModule, TranslocoPipe, AppCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="flex flex-col gap-2">
      @for (c of contributions(); track c.lineId) {
        <li
          class="flex flex-col gap-2 rounded-lg bg-surface-container-low p-4"
          data-testid="savings-goal-contribution-row"
        >
          <div class="flex items-center gap-3">
            <mat-icon
              [class.text-financial-savings]="!!c.checkedAt"
              [class.icon-filled]="!!c.checkedAt"
              [class.text-on-surface-variant]="!c.checkedAt"
              [attr.aria-label]="
                (c.checkedAt
                  ? 'savingsGoals.detail.contributionChecked'
                  : 'savingsGoals.detail.contributionUnchecked'
                ) | transloco
              "
              >{{
                c.checkedAt ? 'check_circle' : 'radio_button_unchecked'
              }}</mat-icon
            >
            <div class="flex flex-col min-w-0 flex-1">
              <span class="text-body-large truncate ph-no-capture">{{
                c.name
              }}</span>
              <span class="text-body-small text-on-surface-variant">
                {{ periodOf(c) | date: monthYearFormat() }}
              </span>
            </div>
            <span
              class="text-body-large font-medium tabular-nums ph-no-capture"
            >
              {{ c.amount | appCurrency: currency() : '1.2-2' }}
            </span>
          </div>
          @if (c.transactions.length > 0) {
            <!-- Réel de l'enveloppe — inset container makes the
                 parent/child relationship readable at a glance. -->
            <div
              class="ml-9 flex flex-col gap-2 rounded-md bg-surface-container px-4 py-3"
            >
              <span class="text-label-small text-on-surface-variant">
                {{ 'savingsGoals.detail.contributionTransactions' | transloco }}
              </span>
              <ul class="flex flex-col gap-2">
                @for (tx of c.transactions; track tx.id) {
                  <li
                    class="flex items-center gap-3"
                    data-testid="savings-goal-contribution-transaction"
                  >
                    <mat-icon
                      class="text-base! w-auto! h-auto! leading-none"
                      [class.text-financial-savings]="!!tx.checkedAt"
                      [class.icon-filled]="!!tx.checkedAt"
                      [class.text-on-surface-variant]="!tx.checkedAt"
                      [attr.aria-label]="
                        (tx.checkedAt
                          ? 'savingsGoals.detail.contributionChecked'
                          : 'savingsGoals.detail.contributionUnchecked'
                        ) | transloco
                      "
                      >{{
                        tx.checkedAt ? 'check_circle' : 'radio_button_unchecked'
                      }}</mat-icon
                    >
                    <div class="flex min-w-0 flex-1 flex-col">
                      <span class="text-body-medium truncate ph-no-capture">
                        {{ tx.name }}
                      </span>
                      <span class="text-body-small text-on-surface-variant">
                        {{ tx.transactionDate | date: shortDateFormat() }}
                      </span>
                    </div>
                    <span class="text-body-medium tabular-nums ph-no-capture">
                      {{ tx.amount | appCurrency: currency() : '1.2-2' }}
                    </span>
                  </li>
                }
              </ul>
            </div>
          }
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class GoalContributionsList {
  readonly contributions = input.required<SavingsGoalContribution[]>();
  readonly currency = input.required<SupportedCurrency>();

  protected readonly shortDateFormat = computed(
    () => getDateDisplayFormats(this.currency()).shortDate,
  );
  protected readonly monthYearFormat = computed(
    () => getDateDisplayFormats(this.currency()).monthYear,
  );

  protected periodOf(contribution: SavingsGoalContribution): Date {
    return new Date(contribution.budgetYear, contribution.budgetMonth - 1, 1);
  }
}
