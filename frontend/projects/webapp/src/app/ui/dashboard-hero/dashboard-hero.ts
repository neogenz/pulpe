import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  output,
} from '@angular/core';
import { DecimalPipe, formatNumber } from '@angular/common';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import {
  CURRENCY_METADATA,
  type BudgetPeriodDates,
  type SupportedCurrency,
} from 'pulpe-shared';

const FULL_BAR_PERCENT = 100;

@Component({
  selector: 'pulpe-dashboard-hero',
  imports: [DecimalPipe, TranslocoPipe],
  template: `
    <div
      class="hero-container rounded-3xl p-6 pb-5 relative overflow-hidden cursor-pointer motion-safe:transition-transform motion-safe:hover:scale-[0.99] dark:border dark:border-white/5"
      [class.budget-over]="isOverBudget()"
      [class.budget-warning]="isWarning()"
      (click)="heroClick.emit()"
      (keydown.enter)="heroClick.emit()"
      (keydown.space)="$event.preventDefault(); heroClick.emit()"
      tabindex="0"
      role="button"
      [attr.aria-label]="remainingAriaLabel()"
    >
      <div
        class="absolute -right-10 -bottom-10 w-56 h-56 bg-white/15 rounded-full blur-3xl pointer-events-none"
      ></div>
      <div
        class="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none"
      ></div>

      <div class="flex items-center gap-2 mb-6 relative z-10">
        <div
          class="w-2 h-2 rounded-full motion-safe:animate-pulse indicator-dot"
        ></div>
        <h2
          class="font-bold text-headline-medium capitalize tracking-tight leading-none"
        >
          {{ periodLabel() }}
        </h2>
      </div>

      <!-- Disponible section -->
      <div class="mb-7 relative z-10">
        <div class="flex items-baseline gap-2">
          <span
            class="font-extrabold text-display-large tracking-tighter leading-none ph-no-capture"
            data-testid="hero-remaining-amount"
          >
            {{ remaining() | number: '1.0-0' : locale() }}
          </span>
          <span class="text-title-large font-semibold opacity-70">{{
            currencySymbol()
          }}</span>
        </div>
        <!-- The label sits under the number rather than above it: the amount is
             what the card is for, and it should be the first thing read. No
             opacity on this line either — the hero is a saturated gradient,
             where every point of alpha comes straight off the contrast ratio;
             12px at 0.88 measured 3.8:1 on the amber state. -->
        <!-- The full label PRODUCT.md names, and the one the product tour
             teaches. The legend below keeps the short form: it sits forty pixels
             under this line, against the same amount. -->
        <p class="text-body-small mt-1.5">
          {{ 'dashboard.availableToSpend' | transloco }}
          @let rollover = rolloverAmount();
          @if (rollover !== 0) {
            <span class="ph-no-capture">
              · {{ 'dashboard.rollover' | transloco }}
              {{ rollover > 0 ? '+' : ''
              }}{{ rollover | number: '1.0-0' : locale() }}
              {{ currencySymbol() }}
            </span>
          }
        </p>
      </div>

      <!-- Progress Bar -->
      <div class="relative z-10">
        <p class="progress-verdict">{{ statusMessage() | transloco }}</p>

        <div
          class="progress-bar"
          role="progressbar"
          [attr.aria-valuenow]="realizedPercentage()"
          aria-valuemin="0"
          aria-valuemax="100"
          [attr.aria-label]="progressAriaLabel()"
        >
          <div class="progress-segments">
            @if (spentShare() > 0) {
              <div
                class="segment segment-spent motion-safe:transition-all motion-safe:duration-1000"
                [style.flex-grow]="spentShare()"
              ></div>
            }
            @if (engagedShare() > 0) {
              <div
                class="segment segment-engaged motion-safe:transition-all motion-safe:duration-1000"
                [style.flex-grow]="engagedShare()"
              ></div>
            }
            @if (freeShare() > 0) {
              <div
                class="segment segment-free motion-safe:transition-all motion-safe:duration-1000"
                [style.flex-grow]="freeShare()"
              ></div>
            }
          </div>
        </div>

        <div class="progress-legend">
          <span class="progress-legend-group">
            <!-- Gated on the same condition as the pill it stands for: a key
                 for a segment the bar never drew is a swatch pointing at
                 nothing. -->
            @if (spentShare() > 0) {
              <span class="progress-legend-item">
                <span class="progress-legend-swatch swatch-realized"></span>
                {{ 'dashboard.spent' | transloco }}
                <b class="progress-legend-amount ph-no-capture">
                  {{ realizedExpenses() | number: '1.0-0' : locale() }}
                </b>
              </span>
            }
            <span class="progress-legend-item">
              <span class="progress-legend-swatch swatch-engaged"></span>
              {{ 'dashboard.engaged' | transloco }}
              <b class="progress-legend-amount ph-no-capture">
                <span data-testid="hero-expenses-amount">{{
                  engagedNotSpent() | number: '1.0-0' : locale()
                }}</span>
              </b>
            </span>
            <!-- The outlined pill was the one segment left unnamed, on the
                 theory that the card already prints its amount at 57px. It
                 doesn't read that way: an outline with no key looks like the
                 track the bar sits in rather than a quantity. Same word as the
                 caption above the number, so the money in the bar and the money
                 in the headline are visibly the same money. -->
            @if (freeShare() > 0) {
              <span class="progress-legend-item">
                <span class="progress-legend-swatch swatch-free"></span>
                {{ 'dashboard.available' | transloco }}
                <b class="progress-legend-amount ph-no-capture">
                  {{ remaining() | number: '1.0-0' : locale() }}
                </b>
              </span>
            }
          </span>
          <!-- A preposition, not a noun. This item sits at the right edge,
               directly under the outlined pill, and any noun parked there gets
               read as that pill's label — which is how "Budget" ended up
               naming the wrong thing. "sur" can only be the denominator of the
               keys that precede it. -->
          <span class="progress-legend-item progress-legend-total">
            {{ 'dashboard.on' | transloco }}
            <b class="progress-legend-amount ph-no-capture">
              {{ available() | number: '1.0-0' : locale() }}
              {{ currencySymbol() }}
            </b>
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      /* --hero-surface is the state's own hue, unmixed. The progress bar tints
         itself from it so its steps stay inside the card's colour family
         instead of greying it out with black and white. */
      .hero-container {
        --hero-surface: var(--pulpe-hero-primary);
        background: linear-gradient(
          145deg,
          var(--hero-surface) 0%,
          color-mix(in srgb, var(--hero-surface) 75%, black) 100%
        );
        color: var(--pulpe-hero-primary-text);
        box-shadow: var(--mat-sys-level2);
      }

      /* The largest target on the page is a div[role=button]; Material's focus
         ring never reaches it, so it has to carry its own. Double ring: the card
         is a saturated gradient, and a single one disappears on one of the two
         hero states. */
      .hero-container:focus-visible {
        outline: 3px solid var(--pulpe-hero-primary-text);
        outline-offset: 3px;
        box-shadow:
          var(--mat-sys-level2),
          0 0 0 6px color-mix(in srgb, var(--hero-surface) 60%, black);
      }

      .hero-container.budget-warning {
        --hero-surface: var(--pulpe-hero-warning);
        color: var(--pulpe-hero-warning-text);
      }

      .hero-container.budget-over {
        --hero-surface: var(--pulpe-hero-error);
        color: var(--pulpe-hero-error-text);
      }

      .indicator-dot {
        background-color: currentColor;
      }

      .progress-verdict {
        font-size: var(--mat-sys-body-medium-size);
        line-height: var(--mat-sys-body-medium-line-height);
        font-weight: 700;
        margin-bottom: 0.75rem;
      }

      .progress-bar {
        position: relative;
        height: 14px;
      }

      /* Three disjoint quantities that add up to the budget, so they are three
         objects rather than layers stacked on one another. The gap between them
         is what separates them: each pill's neighbour is the card, never
         another pill, which frees the tones from having to clear 3:1 against
         each other inside a range that never had room for it. */
      .progress-segments {
        position: absolute;
        inset: 0;
        display: flex;
        gap: 3px;
      }

      .segment {
        flex-basis: 0;
        min-width: 3px;
        border-radius: var(--mat-sys-corner-full);
      }

      .segment-spent {
        background-color: currentColor;
      }

      .segment-engaged {
        background: color-mix(
          in srgb,
          currentColor var(--pulpe-hero-engaged-lift),
          var(--hero-surface)
        );
      }

      /* Empty is drawn rather than filled. No fill can sit 3:1 below this card
         — pure black tops out at 2.06:1 on the amber hero — so the part of the
         budget still untouched is an outline, which reads as "still yours"
         instead of as a hole cut in the card. */
      .segment-free {
        box-shadow: inset 0 0 0 1.5px currentColor;
      }

      .progress-legend {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.375rem 0.75rem;
        margin-top: 0.75rem;
        font-size: var(--mat-sys-label-large-size);
      }

      .progress-legend-group {
        display: inline-flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.375rem 0.75rem;
      }

      .progress-legend-item {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        white-space: nowrap;
      }

      /* Pushed to the end rather than spread by the container: space-between
         only right-aligns the ceiling while it shares a line with the keys, and
         drops it to the left the moment a phone width wraps it. */
      .progress-legend-total {
        margin-inline-start: auto;
      }

      /* A swatch is a miniature of its pill, so it carries the pill's own
         treatment and nothing more: no ring here, because the pill has none.
         The ring this once needed was paying for the scrim panel the bar used
         to sit on; against the card the engaged swatch measures 4.68:1 and
         stands on its own. */
      .progress-legend-swatch {
        width: 0.5rem;
        height: 0.5rem;
        border-radius: var(--mat-sys-corner-full);
        background-color: currentColor;
      }

      .swatch-engaged {
        background: color-mix(
          in srgb,
          currentColor var(--pulpe-hero-engaged-lift),
          var(--hero-surface)
        );
      }

      /* Same stroke as the pill, not a filled dot: a solid swatch standing for
         a hollow segment is the mismatch that made the bar unreadable in the
         first place. */
      .swatch-free {
        background: none;
        box-shadow: inset 0 0 0 1.5px currentColor;
      }

      .progress-legend-amount {
        font-weight: 800;
        font-variant-numeric: tabular-nums;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardHero {
  readonly #monthFormatter = new Intl.DateTimeFormat(inject(LOCALE_ID), {
    month: 'long',
  });
  readonly #transloco = inject(TranslocoService);
  readonly expenses = input.required<number>();
  readonly available = input.required<number>();
  readonly periodDates = input.required<BudgetPeriodDates>();
  readonly rolloverAmount = input(0);
  readonly timeElapsedPercentage = input(0);
  readonly paceStatus = input<'on-track' | 'tight'>('on-track');
  readonly warningThreshold = input(90);

  readonly currency = input<SupportedCurrency>('CHF');
  readonly locale = input<string>('de-CH');
  protected readonly currencySymbol = computed(
    () => CURRENCY_METADATA[this.currency()].symbol,
  );
  readonly remaining = input.required<number>();
  readonly budgetConsumedPercentage = input.required<number>();
  readonly realizedExpenses = input.required<number>();
  readonly realizedPercentage = input.required<number>();

  readonly heroClick = output<void>();

  readonly absExpenses = computed(() => Math.abs(this.expenses()));

  // `expenses` is the whole left side of the bar: what has already gone out plus
  // what is still only planned. The bar draws those two as separate segments, so
  // the middle key has to drop the part the first key already claimed —
  // otherwise "Dépensé 900, Engagé 3491, Disponible 1309 sur 4800" asks the
  // reader to trust three numbers that do not add up to the fourth.
  readonly engagedNotSpent = computed(() =>
    Math.max(0, this.absExpenses() - this.realizedExpenses()),
  );

  // The bar shows the budget split into three parts that do not overlap, and the
  // legend now names exactly those three.
  protected readonly spentShare = computed(() =>
    Math.min(Math.max(this.realizedPercentage(), 0), FULL_BAR_PERCENT),
  );

  protected readonly engagedShare = computed(() =>
    Math.max(
      0,
      Math.min(this.budgetConsumedPercentage(), FULL_BAR_PERCENT) -
        this.spentShare(),
    ),
  );

  protected readonly freeShare = computed(() =>
    Math.max(
      0,
      FULL_BAR_PERCENT -
        Math.min(this.budgetConsumedPercentage(), FULL_BAR_PERCENT),
    ),
  );

  readonly isOverBudget = computed(() => this.remaining() < 0);

  readonly isWarning = computed(
    () =>
      !this.isOverBudget() &&
      this.budgetConsumedPercentage() > this.warningThreshold(),
  );
  readonly budgetStatus = computed<'on-track' | 'warning' | 'over-budget'>(
    () => {
      if (this.isOverBudget()) return 'over-budget';
      if (this.isWarning()) return 'warning';
      return 'on-track';
    },
  );

  readonly periodLabel = computed(() => {
    const dates = this.periodDates();
    if (!dates) return '';
    const start = dates.startDate.getTime();
    const end = dates.endDate.getTime();
    const middleDate = new Date(start + (end - start) / 2);
    return this.#monthFormatter.format(middleDate);
  });

  // The card answers "am I doing OK?" out loud instead of leaving the user to
  // derive it from two percentages. Pace is only meaningful while the budget
  // still holds, so the budget verdict outranks it.
  protected readonly statusMessage = computed(() => {
    switch (this.budgetStatus()) {
      case 'over-budget':
        return 'dashboard.status.overBudget';
      case 'warning':
        return 'dashboard.status.almostSpent';
      default:
        return this.paceStatus() === 'tight'
          ? 'dashboard.status.fastPace'
          : 'dashboard.status.onTrack';
    }
  });

  // Same partition as the legend: the two shares are read out one after the
  // other, so the second must not restate the first.
  protected readonly progressAriaLabel = computed(() =>
    this.#transloco.translate('dashboard.progressLabel', {
      realized: this.realizedPercentage(),
      engaged: Math.max(
        0,
        this.budgetConsumedPercentage() - this.realizedPercentage(),
      ),
      elapsed: this.timeElapsedPercentage(),
    }),
  );

  protected readonly remainingAriaLabel = computed(() => {
    // Same digits the card renders — a screen reader announcing centimes the
    // sighted user never sees reads as a different number. ISO code rather than
    // the symbol, which screen readers pronounce more reliably.
    const amount = formatNumber(this.remaining(), this.locale(), '1.0-0');
    const formatted = `${amount} ${this.currency()}`;
    const status = this.#transloco.translate(this.statusMessage());
    return `${this.#transloco.translate('dashboard.availableToSpend')} ${formatted} — ${this.periodLabel()} — ${status}`;
  });
}
