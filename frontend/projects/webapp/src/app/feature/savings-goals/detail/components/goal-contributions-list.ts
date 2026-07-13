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
 * most of them identical future « à pointer » rows — pure noise here. So by
 * default we surface only what carries information: the contributions already
 * pointées (with their real transactions nested) plus the single next month to
 * point. The full ledger stays one click away behind « Voir tout ». Pure
 * présentation, inputs only (+ a local disclosure signal).
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
        {{
          'savingsGoals.detail.contributionsSummary'
            | transloco: { checked: checkedCount(), pending: pendingCount() }
        }}
      </p>

      <ul class="flex flex-col gap-2">
        @for (c of visibleContributions(); track c.lineId) {
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
              <div class="flex min-w-0 flex-1 flex-col">
                <span class="flex min-w-0 items-center gap-2">
                  <span class="text-body-large truncate ph-no-capture">{{
                    c.name
                  }}</span>
                  @if (!c.checkedAt && c.lineId === nextToPoint()?.lineId) {
                    <span
                      class="text-label-small font-medium rounded-full px-2 py-0.5
                             bg-primary-container text-on-primary-container shrink-0"
                      data-testid="goal-contribution-next-badge"
                    >
                      {{
                        'savingsGoals.detail.nextContributionBadge' | transloco
                      }}
                    </span>
                  }
                </span>
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

  protected readonly checkedContributions = computed(() =>
    this.contributions().filter((c) => c.checkedAt != null),
  );
  protected readonly checkedCount = computed(
    () => this.checkedContributions().length,
  );
  protected readonly pendingCount = computed(
    () => this.contributions().filter((c) => c.checkedAt == null).length,
  );
  /** Earliest month still à pointer — the one actionable row worth surfacing. */
  protected readonly nextToPoint = computed(
    () => this.contributions().find((c) => c.checkedAt == null) ?? null,
  );

  /** Collapsed: the pointées (real activity) + the next month to point. */
  protected readonly visibleContributions = computed(() => {
    if (this.showAll()) return this.contributions();
    const next = this.nextToPoint();
    const subset = next
      ? [...this.checkedContributions(), next]
      : this.checkedContributions();
    return [...subset].sort(
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
