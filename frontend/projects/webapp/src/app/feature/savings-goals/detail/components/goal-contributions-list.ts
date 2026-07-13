import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  type SavingsGoalContribution,
  type SupportedCurrency,
} from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';
import { getDateDisplayFormats } from '@core/date/date-display-formats';

/**
 * « Ton suivi » (docs/SAVINGS_PLAN.md §3, dernier bloc). Tracking of the REALISED
 * savings, not a second copy of the plan (« Ton plan, mois par mois » already
 * lists every planned month). A multi-year goal links dozens of monthly lines,
 * most of them identical future « à pointer » rows — pure noise here. So the
 * surface is three zones: a positive one-line headline (« N mois mis de côté »,
 * never an « à pointer » backlog count — that reads as chores, against the
 * no-alert ethos); the single next month to point promoted into a savings-tinted
 * callout (the one forward action, unmissable); and « Déjà pointé » — the months
 * that actually carry activity (pointées OR already holding real transactions),
 * with their real transactions nested. The full ledger stays behind « Voir tout ».
 * Pure présentation, inputs only (+ a local disclosure signal).
 */
@Component({
  selector: 'pulpe-goal-contributions-list',
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
    AppCurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex flex-col gap-3"
      data-testid="savings-goal-contributions-panel"
    >
      <p
        class="text-body-small text-on-surface-variant"
        data-testid="goal-contributions-summary"
      >
        @if (checkedCount() > 0) {
          {{
            'savingsGoals.detail.contributionsSummary'
              | transloco: { checked: checkedCount() }
          }}
        } @else {
          {{ 'savingsGoals.detail.contributionsSummaryEmpty' | transloco }}
        }
      </p>

      <!-- The one forward action: the next month to point, promoted out of the
           ledger into the page's savings-tinted callout idiom so it can't be
           mistaken for just another row. RG-002: savings green, never an alert. -->
      @if (nextToPoint(); as next) {
        <div
          class="flex items-center gap-3 rounded-2xl bg-financial-savings/10 p-4"
          data-testid="goal-contribution-next"
        >
          <mat-icon class="shrink-0 text-financial-savings" aria-hidden="true"
            >radio_button_unchecked</mat-icon
          >
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="text-label-small font-medium text-financial-savings">
              {{ 'savingsGoals.detail.nextContributionLabel' | transloco }}
            </span>
            <span class="text-body-large truncate ph-no-capture">
              {{ periodOf(next) | date: monthYearFormat() }}
            </span>
          </div>
          <span class="text-body-large font-medium tabular-nums ph-no-capture">
            {{ next.amount | appCurrency: currency() : '1.2-2' }}
          </span>
        </div>
      }

      @if (visibleContributions().length > 0) {
        @if (!showAll()) {
          <span
            class="text-label-medium font-medium text-on-surface-variant"
            data-testid="goal-contributions-done-label"
          >
            {{ 'savingsGoals.detail.contributionsDoneLabel' | transloco }}
          </span>
        }
        <ul class="flex flex-col gap-2">
          @for (c of visibleContributions(); track c.lineId) {
            <li
              class="flex flex-col gap-2 rounded-xl bg-surface-container-low p-4"
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
                <div class="flex min-w-0 flex-1 flex-col">
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
                  class="ml-9 flex flex-col gap-2 rounded-lg bg-surface-container px-4 py-3"
                >
                  <span class="text-label-small text-on-surface-variant">
                    {{
                      'savingsGoals.detail.contributionTransactions' | transloco
                    }}
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
                            tx.checkedAt
                              ? 'check_circle'
                              : 'radio_button_unchecked'
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
                        <span
                          class="text-body-medium tabular-nums ph-no-capture"
                        >
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
      }

      @if (hiddenCount() > 0 || showAll()) {
        <button
          matButton
          class="self-center"
          (click)="showAll.set(!showAll())"
          data-testid="goal-contributions-see-all"
        >
          @if (showAll()) {
            {{ 'savingsGoals.detail.contributionsSeeLess' | transloco }}
          } @else {
            {{
              'savingsGoals.detail.contributionsSeeAll'
                | transloco: { count: contributions().length }
            }}
          }
        </button>
      }
    </div>
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

  protected readonly showAll = signal(false);

  /** « Mois mis de côté » = pointées. Drives the positive headline. */
  protected readonly checkedCount = computed(
    () => this.contributions().filter((c) => c.checkedAt != null).length,
  );

  /** Months that carry realised activity — pointées OR already holding real
   *  transactions (early pointage). These are « what happened ». */
  protected readonly activityContributions = computed(() =>
    this.contributions().filter(
      (c) => c.checkedAt != null || c.transactions.length > 0,
    ),
  );

  /** Earliest month still à pointer AND without activity — the one next step. */
  protected readonly nextToPoint = computed(
    () =>
      this.contributions().find(
        (c) => c.checkedAt == null && c.transactions.length === 0,
      ) ?? null,
  );

  /** Collapsed: only the activity rows. Expanded: the full ledger. */
  protected readonly visibleContributions = computed(() => {
    if (this.showAll()) return this.contributions();
    return [...this.activityContributions()].sort(
      (a, b) =>
        a.budgetYear * 12 + a.budgetMonth - (b.budgetYear * 12 + b.budgetMonth),
    );
  });

  protected readonly hiddenCount = computed(
    () => this.contributions().length - this.visibleContributions().length,
  );

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
