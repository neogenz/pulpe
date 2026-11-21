import { formatNumber } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  output,
  viewChild,
  viewChildren,
  type ElementRef,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  availableAfterNote,
  comparedFigure,
  comparisonScreen,
  gapClosedByChecks,
  matchedBreakdown,
  moneyDifference,
  rankedPointingCandidates,
  type BudgetLine,
  type ComparisonScreen,
  type MatchedBreakdown,
  type ReconciliationContext,
  type SupportedCurrency,
  type Transaction,
} from 'pulpe-shared';

import {
  calculateAllConsumptions,
  isLineEffectivelyChecked,
} from '@core/budget';
import { AppCurrencyPipe, CURRENCY_CONFIG } from '@core/currency';

/** Stands in for the amount in a translation, which is then split around it to mask the amount alone. */
export const AMOUNT_SLOT = '\u0000';

/** An amount and its currency never part across two lines. */
export function money(value: number, currency: SupportedCurrency): string {
  return (
    new AppCurrencyPipe().transform(value, currency, '1.2-2') ?? ''
  ).replaceAll(' ', ' ');
}

/** An item that checking moves the compared figure: a movement or a prévision, of this month or a previous one. */
export interface SuggestionRow {
  readonly kind: 'transaction' | 'budgetLine';
  readonly id: string;
  readonly name: string;
  readonly amount: number;
  readonly monthsAgo: 0 | 1 | 2;
  /** The movement's date, for a movement of this month. */
  readonly date: string | null;
  /** Checking it leaves no gap, and its amount is the gap itself (spec §4.2). */
  readonly settles: boolean;
}

export interface Comparison {
  readonly onAccounts: number;
  readonly compared: number;
  /** The figure before the first check of this comparison, once a check moved it. */
  readonly comparedBefore: number | null;
  /** How much nearer zero the gap came since the first check: a check that widens it finds nothing. */
  readonly found: number;
  readonly gap: number;
  readonly screen: ComparisonScreen;
  readonly suggestions: readonly SuggestionRow[];
  /** Items left to check beyond the suggestions, as the budget's « À pointer » list shows them. */
  readonly othersCount: number;
  readonly note: { readonly before: number; readonly after: number };
  readonly matched: MatchedBreakdown;
}

export interface ComparisonInput {
  readonly onAccountsCents: number;
  readonly realizedBalance: number;
  /** « Disponible à dépenser » of the month. */
  readonly available: number;
  readonly budgetLines: readonly BudgetLine[];
  readonly transactions: readonly Transaction[];
  readonly context: ReconciliationContext;
  readonly comparedBefore: number | null;
  readonly isDismissed: boolean;
}

/** Step 2's numbers and screen, from the shared rules (spec.md §4). */
export function buildComparison(input: ComparisonInput): Comparison {
  const { budgetLines, transactions, context } = input;
  const onAccounts = input.onAccountsCents / 100;
  const compared = comparedFigure(
    input.realizedBalance,
    context.priorCorrection,
    context.startingAmount,
  );
  const gap = moneyDifference(onAccounts, compared);
  const comparedBefore =
    input.comparedBefore === compared ? null : input.comparedBefore;
  const suggestions = rankedPointingCandidates(
    gap,
    budgetLines,
    transactions,
    context.priorItems,
  ).flatMap(({ source, id, monthsAgo, remainingGap }): SuggestionRow[] => {
    // A 120 movement on a checked 100 prévision closes a 20 gap: ranked first,
    // but not shown as the exact amount.
    const settles = (amount: number) =>
      remainingGap === 0 && moneyDifference(amount, Math.abs(gap)) === 0;
    const row = { id, monthsAgo };
    if (source === 'prior') {
      const prior = context.priorItems.find((item) => item.id === id);
      return prior
        ? [
            {
              ...row,
              ...prior,
              kind: prior.source,
              monthsAgo,
              date: null,
              settles: settles(prior.amount),
            },
          ]
        : [];
    }
    const item =
      source === 'budgetLine'
        ? budgetLines.find((line) => line.id === id)
        : transactions.find((transaction) => transaction.id === id);
    if (!item) return [];
    const date = 'transactionDate' in item ? item.transactionDate : null;
    return [
      {
        ...row,
        kind: source,
        name: item.name,
        amount: item.amount,
        date,
        settles: settles(item.amount),
      },
    ];
  });
  // The budget's « À pointer » list: a checked prévision hides its movements.
  const consumption = calculateAllConsumptions(
    [...budgetLines],
    [...transactions],
  );
  const shownLineIds = new Set(
    budgetLines
      .filter((line) => !isLineEffectivelyChecked(line, consumption))
      .map((line) => line.id),
  );
  const toCheckIds = new Set([
    ...shownLineIds,
    ...transactions
      .filter(
        (transaction) =>
          transaction.checkedAt === null &&
          (transaction.budgetLineId === null ||
            shownLineIds.has(transaction.budgetLineId)),
      )
      .map((transaction) => transaction.id),
  ]);
  return {
    onAccounts,
    compared,
    comparedBefore,
    found:
      comparedBefore === null
        ? 0
        : gapClosedByChecks({ onAccounts, comparedBefore, compared }),
    gap,
    screen: comparisonScreen({
      gap,
      candidateCount: suggestions.length,
      dismissed: input.isDismissed,
      first: !context.hasCompletedComparison && context.startingAmount === 0,
      // shortcut: the pay-day rule is not wired yet; its screen and inputs come with « Salaire en avance ».
      salaryMaybeEarly: false,
    }),
    suggestions,
    othersCount:
      toCheckIds.size -
      suggestions.filter((row) => toCheckIds.has(row.id)).length,
    note: availableAfterNote(input.available, gap),
    matched: matchedBreakdown({
      available: input.available,
      compared,
      startingAmount: context.startingAmount,
    }),
  };
}

/** The body of step 2: verdict, the two figures and the screen; the dialog's footer carries its actions. */
@Component({
  selector: 'pulpe-reconcile-compare-step',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let view = comparison();
    <p class="m-0 mt-3 text-sm text-on-surface-variant">
      {{ 'currentMonth.reconcile.compare.stepLabel' | transloco }}
    </p>
    <h3
      #heading
      tabindex="-1"
      class="step-heading m-0 mb-5 text-headline-small font-bold text-balance tabular-nums focus:outline-none"
      aria-live="polite"
      aria-atomic="true"
      data-testid="reconcile-step-heading"
    >
      @if (view.gap === 0) {
        {{ 'currentMonth.reconcile.compare.matched' | transloco }}
      } @else {
        <!-- Masked: the amount only, so « Masquer les montants » keeps the words readable. -->
        @let sentence =
          (
            (view.gap < 0
              ? 'currentMonth.reconcile.compare.less'
              : 'currentMonth.reconcile.compare.more'
            ) | transloco: { amount: AMOUNT_SLOT }
          ).split(AMOUNT_SLOT);
        {{ sentence[0]
        }}<span class="ph-no-capture">{{ money(abs(view.gap)) }}</span
        >{{ sentence[1] }}
      }
    </h3>

    @if (view.screen === 'matched') {
      <div class="flex flex-col items-center gap-4">
        <!-- mat-icon's own color wins over a utility on it: the wrapper carries it. -->
        <div
          class="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <mat-icon class="icon-filled scale-150">check_circle</mat-icon>
        </div>
        <dl
          class="m-0 grid w-full gap-3 rounded-(--pulpe-surface-radius-panel) bg-surface-container-low p-4 tabular-nums"
          data-testid="reconcile-matched"
        >
          @if (view.matched.stillPlanned !== 0) {
            <div class="flex items-baseline justify-between gap-4">
              <dt class="text-on-surface-variant">
                {{
                  (view.matched.stillPlanned < 0
                    ? 'currentMonth.reconcile.compare.stillPlanned'
                    : 'currentMonth.reconcile.compare.stillToReceive'
                  ) | transloco
                }}
              </dt>
              <dd class="ph-no-capture m-0 whitespace-nowrap">
                {{ signed(view.matched.stillPlanned) }}
              </dd>
            </div>
          }
          @if (view.matched.beforePulpe !== 0) {
            <div class="flex items-baseline justify-between gap-4">
              <dt class="text-on-surface-variant">
                {{ 'currentMonth.reconcile.compare.beforePulpe' | transloco }}
              </dt>
              <dd class="ph-no-capture m-0 whitespace-nowrap">
                {{ signed(view.matched.beforePulpe) }}
              </dd>
            </div>
          }
          <div
            class="flex items-baseline justify-between gap-4 border-t border-outline-variant pt-3 font-semibold"
          >
            <dt>{{ 'currentMonth.reconcile.compare.toSpend' | transloco }}</dt>
            <!-- Green only when something is left: an overspent month is no good news. -->
            <dd
              class="ph-no-capture m-0 whitespace-nowrap"
              [class.text-primary]="view.matched.remaining >= 0"
              [class.text-on-surface]="view.matched.remaining < 0"
              data-testid="reconcile-to-spend"
            >
              {{ money(view.matched.remaining) }}
            </dd>
          </div>
        </dl>
      </div>
    } @else {
      <dl
        class="m-0 mb-5 grid gap-2 rounded-(--pulpe-surface-radius-panel) bg-surface-container-low p-4 tabular-nums"
        data-testid="reconcile-figures"
      >
        <div class="flex items-baseline justify-between gap-4">
          <dt class="text-on-surface-variant">
            {{ 'currentMonth.reconcile.compare.onAccounts' | transloco }}
          </dt>
          <dd class="ph-no-capture m-0 font-semibold whitespace-nowrap">
            {{ money(view.onAccounts) }}
          </dd>
        </div>
        <div class="flex items-baseline justify-between gap-4">
          <dt class="text-on-surface-variant">
            {{ 'currentMonth.reconcile.compare.inPulpe' | transloco }}
          </dt>
          <dd class="m-0 flex flex-col items-end">
            @if (view.comparedBefore !== null) {
              <s
                class="ph-no-capture whitespace-nowrap text-on-surface-variant"
                data-testid="reconcile-compared-before"
                >{{ money(view.comparedBefore) }}</s
              >
            }
            <span class="ph-no-capture font-semibold whitespace-nowrap">{{
              money(view.compared)
            }}</span>
          </dd>
        </div>
        <!-- As on iOS: nothing found, no line. -->
        @if (view.found > 0) {
          <div
            class="mt-2 flex items-center gap-3"
            data-testid="reconcile-found"
          >
            <mat-progress-bar
              class="flex-1"
              mode="determinate"
              [value]="foundPercent()"
              aria-hidden="true"
            />
            @let found =
              (
                'currentMonth.reconcile.compare.found'
                | transloco: { amount: AMOUNT_SLOT }
              ).split(AMOUNT_SLOT);
            <span class="text-sm whitespace-nowrap text-primary"
              >{{ found[0]
              }}<span class="ph-no-capture">{{ money(view.found) }}</span
              >{{ found[1] }}</span
            >
          </div>
        }
      </dl>

      @switch (view.screen) {
        @case ('suggestions') {
          <p class="m-0 mb-3 text-body-medium text-pretty">
            {{
              (view.gap > 0
                ? 'currentMonth.reconcile.compare.leadIncome'
                : hasOwe()
                  ? 'currentMonth.reconcile.compare.leadCard'
                  : 'currentMonth.reconcile.compare.leadExpense'
              ) | transloco
            }}
          </p>
          <ul
            class="m-0 list-none overflow-hidden rounded-(--pulpe-surface-radius-panel) bg-surface-container-low p-0"
          >
            @for (row of view.suggestions; track row.id; let index = $index) {
              <li class="border-b border-outline-variant last:border-b-0">
                <button
                  #suggestion
                  type="button"
                  role="checkbox"
                  class="flex min-h-16 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-on-surface hover:bg-surface-container-high focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:cursor-default"
                  [attr.aria-checked]="checkingId() === row.id"
                  [disabled]="isBusy()"
                  (click)="pick(row, index)"
                  data-testid="reconcile-suggestion"
                >
                  @let isChecking = checkingId() === row.id;
                  <span
                    class="flex shrink-0"
                    [class.text-primary]="isChecking"
                    [class.text-on-surface-variant]="!isChecking"
                    aria-hidden="true"
                  >
                    <mat-icon>{{
                      isChecking ? 'check_box' : 'check_box_outline_blank'
                    }}</mat-icon>
                  </span>
                  <span class="flex min-w-0 flex-1 flex-col">
                    <span class="ph-no-capture truncate text-body-large">{{
                      row.name
                    }}</span>
                    <span
                      class="text-body-small text-on-surface-variant"
                      data-testid="reconcile-suggestion-detail"
                      >{{
                        row.monthsAgo === 0 && row.date !== null
                          ? dayMonth(row.date)
                          : (detailKey(row.monthsAgo) | transloco)
                      }}</span
                    >
                  </span>
                  <span
                    class="ph-no-capture shrink-0 rounded-lg px-2 py-0.5 font-semibold whitespace-nowrap tabular-nums"
                    [class]="
                      row.settles
                        ? 'bg-primary-container text-on-primary-container'
                        : ''
                    "
                    data-testid="reconcile-suggestion-amount"
                    >{{ money(row.amount) }}</span
                  >
                </button>
              </li>
            }
          </ul>
          @if (view.othersCount > 0) {
            <button
              matButton
              type="button"
              class="mt-2 -ml-3"
              (click)="viewOthers.emit()"
              data-testid="reconcile-view-items-button"
            >
              {{
                (view.othersCount === 1
                  ? 'currentMonth.reconcile.compare.othersOne'
                  : 'currentMonth.reconcile.compare.othersMany'
                ) | transloco: { count: view.othersCount }
              }}
            </button>
          }
          @let owe = oweTotal();
          @if (owe !== null) {
            <div
              class="mt-4 flex flex-col items-start gap-2 rounded-(--pulpe-surface-radius-panel) bg-surface-container-low p-4"
              data-testid="reconcile-owe-box"
            >
              <p class="m-0 text-body-medium">
                {{ 'currentMonth.reconcile.compare.oweQuestion' | transloco }}
              </p>
              <button
                matButton="outlined"
                type="button"
                [disabled]="isBusy()"
                (click)="removeOwe.emit()"
                data-testid="reconcile-remove-owe-button"
              >
                <!-- One inline run: the button lays its children out in flex,
                     which would drop the space before the amount. -->
                @let removeLabel =
                  (
                    'currentMonth.reconcile.compare.removeOwe'
                    | transloco: { amount: AMOUNT_SLOT }
                  ).split(AMOUNT_SLOT);
                <span
                  >{{ removeLabel[0]
                  }}<span class="ph-no-capture">{{ money(owe) }}</span
                  >{{ removeLabel[1] }}</span
                >
              </button>
            </div>
          }
        }
        @case ('smallGap') {
          <div
            class="flex flex-col gap-3 rounded-(--pulpe-surface-radius-panel) bg-surface-container-low p-4"
            data-testid="reconcile-small-gap"
          >
            <p class="m-0 text-body-large font-medium">
              {{
                'currentMonth.reconcile.compare.smallGapQuestion' | transloco
              }}
            </p>
            <p
              class="m-0 rounded-xl bg-surface-container-lowest px-3 py-2 text-body-medium text-on-surface-variant tabular-nums"
            >
              {{
                'currentMonth.reconcile.compare.smallGapSample'
                  | transloco: sample(view.gap)
              }}
            </p>
          </div>
        }
        @default {
          @let question =
            (
              'currentMonth.reconcile.compare.largeGapQuestion'
              | transloco: { amount: AMOUNT_SLOT }
            ).split(AMOUNT_SLOT);
          <p
            class="m-0 rounded-(--pulpe-surface-radius-panel) bg-surface-container-low p-4 text-body-large font-medium text-pretty"
            data-testid="reconcile-large-gap"
          >
            {{ question[0]
            }}<span class="ph-no-capture whitespace-nowrap">{{
              signed(view.gap)
            }}</span
            >{{ question[1] }}
          </p>
        }
      }
    }
  `,
})
export class ReconcileCompareStep {
  readonly #numberLocale = computed(
    () => CURRENCY_CONFIG[this.currency()].numberLocale,
  );
  readonly #dayMonth = new Intl.DateTimeFormat(inject(LOCALE_ID), {
    day: 'numeric',
    month: 'short',
  });

  readonly comparison = input.required<Comparison>();
  readonly currency = input.required<SupportedCurrency>();
  /** « Coche les achats faits avec ta carte » instead of « dépenses ». */
  readonly hasOwe = input.required<boolean>();
  /** What the « Je dois » rows total, when removing them is offered. */
  readonly oweTotal = input<number | null>(null);
  readonly checkingId = input<string | null>(null);
  readonly isBusy = input(false);

  readonly check = output<SuggestionRow>();
  readonly removeOwe = output<void>();
  readonly viewOthers = output<void>();

  private readonly heading =
    viewChild.required<ElementRef<HTMLElement>>('heading');
  private readonly suggestionButtons =
    viewChildren<ElementRef<HTMLElement>>('suggestion');
  // Where the picked row stood: it goes disabled, then leaves, taking the focus with it.
  #refocusAt: number | null = null;

  constructor() {
    // Once the check has settled: the row now at that place, else the verdict.
    afterRenderEffect(() => {
      const buttons = this.suggestionButtons();
      if (this.checkingId() !== null || this.#refocusAt === null) return;
      const next = buttons.at(Math.min(this.#refocusAt, buttons.length - 1));
      this.#refocusAt = null;
      (next ?? this.heading()).nativeElement.focus();
    });
  }

  protected pick(row: SuggestionRow, index: number): void {
    this.#refocusAt = index;
    this.check.emit(row);
  }

  protected readonly AMOUNT_SLOT = AMOUNT_SLOT;

  // How far the checks of this comparison went toward the accounts.
  protected readonly foundPercent = computed(() => {
    const { onAccounts, comparedBefore, found } = this.comparison();
    if (comparedBefore === null || found === 0) return 0;
    return Math.min(100, (found / Math.abs(onAccounts - comparedBefore)) * 100);
  });

  protected abs(value: number): number {
    return Math.abs(value);
  }

  protected money(value: number): string {
    return money(value, this.currency());
  }

  protected signed(value: number): string {
    return `${value < 0 ? '−' : '+'}${this.money(Math.abs(value))}`;
  }

  protected detailKey(monthsAgo: 0 | 1 | 2): string {
    return `currentMonth.reconcile.compare.${['plannedThisMonth', 'lastMonth', 'twoMonthsAgo'][monthsAgo]}`;
  }

  protected dayMonth(date: string): string {
    return this.#dayMonth.format(new Date(date));
  }

  // A café paid 3.80 and noted 3.00 (or the reverse): bare figures, like the guide's.
  protected sample(gap: number): { paid: string; noted: string } {
    const [paid, noted] = gap < 0 ? [3.8, 3] : [3, 3.8];
    const format = (value: number) =>
      formatNumber(value, this.#numberLocale(), '1.2-2');
    return { paid: format(paid), noted: format(noted) };
  }
}
