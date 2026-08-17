import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  output,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import {
  CURRENCY_METADATA,
  moneyDifference,
  type BudgetPeriodDates,
  type SupportedCurrency,
} from 'pulpe-shared';

const FULL_BAR_PERCENT = 100;
const MS_PER_DAY = 86_400_000;

let heroInstanceCount = 0;

@Component({
  selector: 'pulpe-dashboard-hero',
  imports: [DecimalPipe, MatIconModule, TranslocoPipe],
  template: `
    <!-- A section, not a role="button": ARIA prunes the roles and names of
         everything inside a button, which takes the heading, the three amounts
         and the "Engagé" explainer off the tree. A named region reads out
         normally, and the control below stretches its hit area over the card so
         tapping anywhere still opens the month. -->
    <section
      class="hero-container p-6 pb-5 relative overflow-hidden motion-safe:transition-transform motion-safe:hover:scale-[0.99] dark:border dark:border-white/5"
      [class.budget-over]="isOverBudget()"
      [class.budget-warning]="isWarning()"
      [attr.aria-labelledby]="headingId"
    >
      <!-- Direct child of the card, because an absolute box resolves against its
           nearest POSITIONED ancestor and every content row here is relative
           z-10 — parked inside one, the control could not reach past that row's
           box nor out of the stacking context its z-index opens. Empty on
           purpose: a control named by its contents would pull the whole card
           back out of the accessibility tree. -->
      <button
        type="button"
        class="hero-action"
        [attr.aria-label]="openMonthAriaLabel()"
        (click)="heroClick.emit()"
      ></button>

      <!-- No decoration in this row: a state dot would repeat what the card
           already states in full, and blurred orbs are ruled out by DESIGN.md
           §4 — depth here is surface tone, not cast light. -->
      <div class="flex items-center gap-2 mb-6 relative z-10">
        <!-- The visible word is the month, which is all this card needs to say
             where it sits. The suffix is for the lists it appears in out of
             context: this heading also names the region, so a heading list and
             a landmark list would both offer a bare "août". Suffixed rather
             than prefixed, to stay clear of the elision French demands of
             "budget de/d'". -->
        <h2
          [id]="headingId"
          class="font-bold text-headline-medium capitalize tracking-tight leading-none"
        >
          {{ periodLabel()
          }}<span class="sr-only">
            — {{ 'dashboard.monthBudgetHeadingSuffix' | transloco }}</span
          >
        </h2>
        <!-- Decoration. It says the card opens something; the control that
             actually opens it covers the whole card above. -->
        <mat-icon class="ml-auto opacity-80 shrink-0" aria-hidden="true"
          >chevron_right</mat-icon
        >
      </div>

      <!-- Disponible section -->
      <div class="hero-amount mb-7 relative z-10">
        <div class="flex items-baseline gap-2">
          <!-- tabular-nums, per DESIGN.md:118 — non-negotiable on hero amounts.
               This is the number the user watches through an optimistic write,
               so its digits must not shift under the finger. -->
          <!-- The step down on narrow screens matches the app's other amount
               hero: 57px extrabold sits in a nowrap flex row inside a container
               that clips rather than wraps, so a five-figure deficit would lose
               its last digits instead of reflowing. -->
          <span
            class="font-extrabold text-display-medium sm:text-display-large tracking-tighter leading-none tabular-nums ph-no-capture"
            data-testid="hero-remaining-amount"
          >
            {{ displayedRemaining() | number: '1.0-2' : locale() }}
          </span>
          <!-- 80%, not 70%: at 22px/600 the suffix is too small and too light
               to earn WCAG's large-text exemption, and 70% white over the
               gradient's lightest stop measured 4.00:1. -->
          <span class="text-title-large font-semibold opacity-80">{{
            currencySymbol()
          }}</span>
        </div>
        <!-- Under the number rather than above it: the amount is what the card
             is for, so it is read first. No opacity on this line — the hero is a
             saturated gradient where every point of alpha comes off the contrast
             ratio, and 12px at 0.88 measures 3.8:1 on the amber state. The full
             label PRODUCT.md names, the one the tour teaches; the legend below
             keeps the short form, forty pixels away against the same amount. -->
        <!-- The ceiling belongs to the number, not to the legend: at the end of
             the keys, three keys and a denominator ask 347px of the 295 a 375px
             screen leaves, and it wrapped alone under two left-aligned keys.
             Here the whole caption measures 207px and reads as one sentence. -->
        <!-- The caption follows the sign, and so does the ceiling. Below zero
             this number is the gap between the plan and the month, not something
             to spend: "disponible à dépenser sur 5'000" would invite the reader
             to spend a shortfall out of a budget it does not come from. -->
        <!-- Two deficits, two captions. Red is by construction the affordable
             plan that real spending carried past the ceiling, so the number
             under it is how far past, not what the plan is short of. -->
        <p class="text-body-small mt-1.5">
          @if (isOverBudget()) {
            {{ 'dashboard.spentBeyondPlan' | transloco }}
          } @else if (isPlanOverAvailable()) {
            <!-- Three deficits, not two. A negative remaining is not enough to
                 blame the plan: remaining counts every franc that has left the
                 account, savings included, so a plan that fits can open a
                 deficit on a deliberate transfer. Blaming the plan requires the
                 plan to be the thing at fault. -->
            @if (planExceedsAvailable()) {
              {{ 'dashboard.missingToCover' | transloco }}
            } @else {
              {{ 'dashboard.missingToBalance' | transloco }}
            }
            <!-- Named as a cause here, as a decomposition in the branch that has
                 a total: this branch prints no ceiling, so the clause cannot be
                 a share of one — and a negative report is often the whole reason
                 the plan does not fit. -->
            @let deficitRollover = rolloverAmount();
            @if (deficitRollover < 0) {
              <span class="tabular-nums ph-no-capture">
                · {{ 'dashboard.rolloverCause' | transloco }}
                {{ deficitRollover | number: '1.0-0' : locale() }}
                {{ currencySymbol() }}
              </span>
            }
          } @else {
            {{ 'dashboard.availableToSpend' | transloco }}
            <span class="tabular-nums ph-no-capture">
              {{ 'dashboard.on' | transloco }}
              {{ available() | number: '1.0-0' : locale() }}
              {{ currencySymbol() }}
            </span>
            <!-- Inside the branch that prints the ceiling, because that is the
                 figure it decomposes: the rollover is already part of it, and
                 set beside it as its own clause the line would read as two
                 numbers to add. "dont" says which of the two contains the
                 other. -->
            @let rollover = rolloverAmount();
            @if (rollover !== 0) {
              <span class="tabular-nums ph-no-capture">
                · {{ 'dashboard.rollover' | transloco }}
                {{ rollover > 0 ? '+' : ''
                }}{{ rollover | number: '1.0-0' : locale() }}
                {{ currencySymbol() }}
              </span>
            }
          }
        </p>
      </div>

      <!-- Progress Bar -->
      <div class="relative z-10">
        <!-- The most consequential sentence on the page, and the one that
             changes without the page moving: recording a transaction rewrites it
             in place, which a sighted user sees and a screen-reader user would
             not otherwise hear. -->
        <p class="progress-verdict" aria-live="polite">
          {{ statusMessage() | transloco }}
          <!-- The verdict compares spending to how far the month has run, so
               how far it has run belongs on the same line: this is that
               sentence's evidence, not a fourth share of the bar. One fact in
               days, one in dates, and the window prints only for a period off
               the calendar month — the case where the month name is not enough
               on its own. -->
          @let progress = monthProgress();
          @let range = periodRange();
          @if (progress || range) {
            <span class="progress-verdict-elapsed">
              {{ progress }}
              @if (progress && range) {
                <span aria-hidden="true"> · </span>
              }
              {{ range }}
            </span>
          }
        </p>

        <!-- The bar is decoration; the legend under it is the content. Both say
             the same three shares, so a progressbar role would read the split
             twice — and a progressbar carries one value, not three. -->
        <div class="progress-bar" aria-hidden="true">
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

        <!-- Three keys for three pills, and nothing else: the denominator sits
             with the number it is a ceiling of, which leaves a homogeneous list
             where a wrap drops a key under a key rather than stranding a lone
             right-aligned total. -->
        <div class="progress-legend">
          <!-- Ungated, unlike the one below: this is the one figure the verdict
               above is drawn from, so a zero here is the reason for the verdict
               rather than the absence of one. Hiding it would leave the card
               asserting a good pace with nothing on screen to check it against. -->
          <!-- The ISO code for the screen reader, the symbol for the eye, in a
               product shipping CHF and EUR side by side. Measured at 375px: the
               two keys go from 109 and 104 wide to 138 and 133 inside 335, and
               the legend stays two rows, 48px. -->
          <span class="progress-legend-item">
            <span class="progress-legend-swatch swatch-realized"></span>
            {{ 'dashboard.spent' | transloco }}
            <b class="progress-legend-amount ph-no-capture">
              <span data-testid="hero-spent-amount">{{
                realizedExpenses() | number: '1.0-0' : locale()
              }}</span>
              <span class="progress-legend-unit" aria-hidden="true">{{
                currencySymbol()
              }}</span>
              <span class="sr-only">{{ currency() }}</span>
            </b>
          </span>
          <!-- Gated like the key below it, and for the same reason: a swatch
               pointing at a segment the bar did not draw reads as the track.
               Gated on the share, not the amount — the shares are rounded and
               the amounts exact, so the two disagree in both directions. -->
          @if (engagedShare() > 0) {
            <span class="progress-legend-item">
              <span class="progress-legend-swatch swatch-engaged"></span>
              {{ 'dashboard.engaged' | transloco }}
              <b class="progress-legend-amount ph-no-capture">
                <!-- hero-engaged-amount, not hero-expenses-amount: this key
                   carries what is still committed and not yet spent, which is
                   total expenses MINUS what the key beside it shows. The name
                   is what keeps an end-to-end assertion from reading it as the
                   total. -->
                <span data-testid="hero-engaged-amount">{{
                  engagedNotSpent() | number: '1.0-0' : locale()
                }}</span>
                <span class="progress-legend-unit" aria-hidden="true">{{
                  currencySymbol()
                }}</span>
                <span class="sr-only">{{ currency() }}</span>
              </b>
            </span>
          }
          <!-- Named, because an outline with no key reads as the track the bar
               sits in rather than as a quantity. Same word as the caption above
               the number, so the money in the bar and the money in the headline
               are visibly the same money. -->
          <!-- The only key without an amount, deliberately: this segment's
               figure is the 57px headline forty pixels above, and a key needs a
               name and a swatch, not a number already on screen. -->
          @if (freeShare() > 0) {
            <span class="progress-legend-item">
              <span class="progress-legend-swatch swatch-free"></span>
              {{ 'dashboard.available' | transloco }}
            </span>
          }
        </div>

        <!-- Permanent, unlike the gloss under it, which retires on the first
             pointing. Money set aside is the one unambiguously good thing a
             month contains, and it otherwise appears only inside a key whose
             word means loss. "dont", because it is a part of the figure above
             and not a fourth share of the bar. -->
        <!-- tabular-nums, like every other amount on this card: the note borrows
             the gloss's quiet type, but that class was written for definitions,
             which carry no digits. These move under the finger — pointing a
             saving prévision patches the figure optimistically. -->
        @if (roundedSavings() > 0) {
          <p
            class="progress-legend-note ph-no-capture tabular-nums"
            data-testid="hero-savings-note"
          >
            {{
              'dashboard.spentIncludesSavings'
                | transloco
                  : {
                      amount: realizedSavings() | number: '1.0-0' : locale(),
                      currency: currencySymbol(),
                    }
            }}
          </p>
        }

        <!-- "Engagé" is a house word, otherwise defined only in the first-run
             tour — a screen most people see once, months before the number
             first surprises them. Written out rather than put behind a tooltip:
             the card navigates on tap, so a touch tooltip would compete with
             that gesture for the same finger. -->
        <!-- Gated on the same condition as the key it defines, or it defines a
             word that has left the card. The first key gets the same treatment:
             this is the only place the hero says what that key counts, and the
             savings it folds in are printed by the line above rather than
             conceded here. -->
        @if (showEngagedHint()) {
          <p class="progress-legend-note" data-testid="hero-legend-gloss">
            {{ 'dashboard.spentHint' | transloco }}
            @if (engagedShare() > 0) {
              {{ 'dashboard.engagedHint' | transloco }}
            }
          </p>
        }
      </div>
    </section>
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
        /* The design system names three radii — 16 for a panel, 24 for a card,
           32 for a hero — and the ramp is a rule the page keeps, not a number
           this file happens to hold. A Tailwind literal here would read as one
           more panel among the seven below. */
        border-radius: var(--pulpe-surface-radius-hero);
        --hero-surface: var(--pulpe-hero-primary);
        background: linear-gradient(
          145deg,
          var(--hero-surface) 0%,
          color-mix(in srgb, var(--hero-surface) 75%, black) 100%
        );
        color: var(--pulpe-hero-primary-text);
        box-shadow: var(--mat-sys-level2);
      }

      /* Two moves, not a choreography: the card lands, then the number settles
         into it. This page is opened daily and read in a glance, so the whole
         thing is over in 440ms and nothing the user came for waits on it — the
         amount is legible from the first frame, only its last 8px arrive late.
         No sweeping light, however obvious it looks on a saturated gradient:
         DESIGN.md §4 rules out cast light, and a surface does not glint.
         Fill mode backwards, never forwards: the card carries a hover scale on
         the same property, and a forwards fill would pin transform to the
         animation's last frame and kill it for the rest of the session. */
      @media (prefers-reduced-motion: no-preference) {
        .hero-container {
          animation: hero-arrive var(--pulpe-motion-slow)
            var(--pulpe-ease-emphasized) backwards;
        }

        .hero-amount {
          animation: hero-amount-settle var(--pulpe-motion-slow)
            var(--pulpe-ease-emphasized) 120ms backwards;
        }
      }

      @keyframes hero-arrive {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
      }

      @keyframes hero-amount-settle {
        from {
          transform: translateY(8px);
        }
      }

      /* The target is the whole card, so the control is the whole card. z-20
         puts it over the content rows, which all sit at z-10 and would
         otherwise take the click themselves; the container sets no z-index of
         its own, so both live in the same stacking context and the larger
         number simply wins. */
      .hero-action {
        position: absolute;
        inset: 0;
        z-index: 20;
        background: none;
        border: 0;
        padding: 0;
        cursor: pointer;
      }

      /* The ring is drawn by the card, because the card is what the control
         covers — an outline on the button itself would be clipped by the
         container's overflow-hidden. Double ring: the card is a saturated
         gradient and a single one disappears on one of the two hero states. */
      .hero-container:has(.hero-action:focus-visible) {
        outline: 3px solid var(--pulpe-hero-primary-text);
        outline-offset: 3px;
        box-shadow:
          var(--mat-sys-level2),
          0 0 0 6px color-mix(in srgb, var(--hero-surface) 60%, black);
      }

      .hero-action:focus-visible {
        outline: none;
      }

      .hero-container.budget-warning {
        --hero-surface: var(--pulpe-hero-warning);
        color: var(--pulpe-hero-warning-text);
      }

      .hero-container.budget-over {
        --hero-surface: var(--pulpe-hero-error);
        color: var(--pulpe-hero-error-text);
      }

      .progress-verdict {
        font-size: var(--mat-sys-body-medium-size);
        line-height: var(--mat-sys-body-medium-line-height);
        font-weight: 700;
        margin-bottom: 0.75rem;
      }

      /* The evidence, not the claim: same line so the two are read together,
         lighter weight so the verdict keeps the emphasis. No opacity — this
         sits on a saturated gradient where every point of alpha comes off the
         contrast ratio, and the weight alone carries the hierarchy. */
      .progress-verdict-elapsed {
        font-weight: 500;
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

      .progress-legend-item {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        white-space: nowrap;
      }

      /* A swatch is a miniature of its pill, so it carries the pill's own
         treatment and nothing more: no ring here, because the pill has none.
         Against the card the engaged swatch measures 4.68:1 on its own. */
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

      /* A step under the figure it qualifies, the way the 22px suffix sits under
         the 45px amount at the top of the card. Secondary is what the Stable
         Amount Rule asks of a unit — present, never competing with the number.

         The margin is load-bearing, not taste: Angular compiles templates with
         preserveWhitespaces off, so the newline between the figure and this span
         is dropped and the pair renders "580CHF". A flex gap is not an option
         here — this sits inside a plain inline <b>, and the gap would also be
         paid to the sr-only span beside it. */
      .progress-legend-unit {
        margin-left: 0.2em;
        font-weight: 500;
        opacity: 0.8;
      }

      /* Explanatory copy, not metadata: it stays quieter than the amounts while
         remaining comfortable to read across the full-width hero. */
      .progress-legend-note {
        margin: 0.5rem 0 0;
        max-inline-size: 68ch;
        font-size: var(--mat-sys-body-medium-size);
        line-height: var(--mat-sys-body-medium-line-height);
        letter-spacing: var(--mat-sys-body-medium-tracking);
        font-weight: 500;
        opacity: 0.84;
        text-wrap: pretty;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardHero {
  readonly #locale = inject(LOCALE_ID);
  readonly #monthFormatter = new Intl.DateTimeFormat(this.#locale, {
    month: 'long',
  });
  readonly #dayMonthFormatter = new Intl.DateTimeFormat(this.#locale, {
    day: 'numeric',
    month: 'short',
  });
  readonly #transloco = inject(TranslocoService);
  // The section is named by its own heading, which needs an id to point at.
  protected readonly headingId = `dashboard-hero-heading-${heroInstanceCount++}`;
  readonly expenses = input.required<number>();
  readonly available = input.required<number>();
  readonly periodDates = input.required<BudgetPeriodDates>();
  // The month this card is showing, told rather than guessed off the middle of
  // the period. The naming convention flips at a payday of 16 — below it the
  // period starts in the month it is named after, at and above it the period
  // ends there — so a midpoint lands one month early for half the paydays.
  readonly period = input<{ month: number; year: number } | null>(null);
  readonly rolloverAmount = input(0);
  // Counted where the clock is. This component is handed the period bounds but
  // never "now", so the day it renders has to arrive already counted rather
  // than be inferred from a share rounded to whole percent.
  readonly elapsedDayOfPeriod = input(0);
  readonly paceStatus = input<'on-track' | 'tight' | 'within-plan'>(
    'within-plan',
  );
  readonly hasRecordedActivity = input(false);
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
  // A part of `realizedExpenses`, never a sibling of it: the formula behind that
  // input filters on `isOutflowKind`, which admits savings, so what is set aside
  // is already inside the figure this one qualifies. Zero by default, so a month
  // with nothing set aside drops the line rather than printing a zero.
  readonly realizedSavings = input(0);

  // Asked of the figure as the line prints it, not as it is held: the line is an
  // aggregation and renders without centimes, so a guard on the raw value would
  // let forty centimes through to print a sentence about money that says none.
  protected readonly roundedSavings = computed(() =>
    Math.round(this.realizedSavings()),
  );

  readonly heroClick = output<void>();

  readonly absExpenses = computed(() => Math.abs(this.expenses()));

  // `expenses` is the whole left side of the bar: what has already gone out plus
  // what is still only planned. The bar draws those two as separate segments, so
  // the middle key drops the part the first key already claimed — otherwise the
  // three keys do not add up to the ceiling printed beside them.
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

  // A budget of nothing has no share of itself left to spend: with income and
  // expenses both zero the consumed percentage is 0, which would draw a
  // full-width outlined pill for a month that does not exist.
  //
  // The amount decides whether the segment exists, the percentage only how wide
  // it is. The share arrives already rounded, so a month a few francs short of
  // its ceiling reads 100% consumed — and a franc left is worth a sliver, not
  // a key dropped under a headline still printing it as available.
  protected readonly freeShare = computed(() => {
    if (this.available() <= 0 || this.remainingDifference() <= 0) return 0;
    return Math.max(
      1,
      FULL_BAR_PERCENT -
        Math.min(this.budgetConsumedPercentage(), FULL_BAR_PERCENT),
    );
  });

  // Whether the plan itself outruns the month, computed from the plan alone.
  // The colour of this card answers "am I spending too fast?", never "did I plan
  // too much?" — a share of the plan over the income is high from the 1st with
  // nothing recorded, which would put the alarm on the users who budget best,
  // against PRODUCT.md's soulagement avant la pression. The plan stays on the
  // card as the "Engagé" key and as the ceiling beside the headline.
  readonly planExceedsAvailable = input(false);

  readonly remainingDifference = computed(() =>
    moneyDifference(this.remaining(), 0),
  );

  // Red is for a month where something really went past its envelope, which is
  // reachable only when the plan itself fits: an affordable plan carried over
  // the ceiling by what actually happened, the one case where "ouvre ton budget
  // pour voir ce qui a dépassé" points at something the user can find.
  //
  // The deficit alone cannot name it. `remaining` counts free savings as
  // outflow while the plan margin counts only planned lines, so a transfer
  // recorded from this page could open the deficit on its own. Red needs
  // something that actually went beyond the plan — which is what a pace verdict
  // other than `within-plan` means.
  readonly isOverBudget = computed(
    () =>
      this.isPlanOverAvailable() &&
      !this.planExceedsAvailable() &&
      this.paceStatus() !== 'within-plan',
  );

  // Owned by the page, because retiring the definition is a fact about the
  // user rather than about this month, and `ui/` cannot reach the store that
  // remembers it.
  readonly showEngagedHint = input(true);

  // The month has less than it owes. Not an exotic state: a negative report is
  // a first-class product concept and puts a budget here on its own, which is
  // why the card carries a caption, a colour and a verdict for it rather than
  // rendering a negative number on the calm gradient.
  readonly isPlanOverAvailable = computed(() => this.remainingDifference() < 0);

  // The caption carries the sign as a word, so the digits do not carry it again:
  // "il manque" over "−500" is a double negative, which reads as a surplus.
  protected readonly displayedRemaining = computed(() =>
    Math.abs(this.remainingDifference()),
  );

  readonly isWarning = computed(
    () =>
      !this.isOverBudget() &&
      (this.isPlanOverAvailable() || this.paceStatus() === 'tight'),
  );

  readonly periodLabel = computed(() => {
    const period = this.period();
    if (period)
      return this.#monthFormatter.format(
        new Date(period.year, period.month - 1, 1),
      );
    const dates = this.periodDates();
    if (!dates) return '';
    const start = dates.startDate.getTime();
    const end = dates.endDate.getTime();
    const middleDate = new Date(start + (end - start) / 2);
    return this.#monthFormatter.format(middleDate);
  });

  // Only when the period does not sit on the calendar month, which is exactly
  // when the month name stops being enough: a payday of 27 makes "février" run
  // from 27 January, so the card names a month the user is not in yet. At the
  // default payday the range would restate the heading, so it says nothing.
  protected readonly periodRange = computed(() => {
    const dates = this.periodDates();
    if (!dates || dates.startDate.getDate() === 1) return '';
    return `${this.#dayMonthFormatter.format(dates.startDate)} – ${this.#dayMonthFormatter.format(dates.endDate)}`;
  });

  // Days rather than the percentage this card already holds: "jour 12 sur 30" is
  // a fact the reader checks against their own calendar, where a third
  // percentage is one more number to reconcile. The total comes off the period,
  // whose bounds are inclusive local midnights and therefore exact; the share
  // arrives rounded to whole percent and would put the day out by one.
  protected readonly monthProgress = computed(() => {
    const day = this.elapsedDayOfPeriod();
    if (day <= 0) return '';
    const dates = this.periodDates();
    if (!dates) return '';
    const totalDays =
      Math.round(
        (dates.endDate.getTime() - dates.startDate.getTime()) / MS_PER_DAY,
      ) + 1;
    if (totalDays <= 0) return '';
    return this.#transloco.translate('dashboard.monthProgress', {
      day: Math.min(day, totalDays),
      total: totalDays,
    });
  });

  // The card answers "am I doing OK?" out loud rather than leaving the user to
  // derive it from two percentages, and it answers from the ledger. What was
  // recorded outranks what was planned: a sentence read off the plan is true
  // every day of every month, and would keep the ones about actual behaviour
  // from ever being reached.
  protected readonly statusMessage = computed(() => {
    if (this.isOverBudget()) return 'dashboard.status.overBudget';
    // Outranks the pace verdict, because a deficit is not a rate: no speed makes
    // a plan fit inside an income it already exceeds, and naming the rate would
    // bury the larger of the two problems.
    //
    // Same three-way split as the caption above, because the instruction differs
    // — "allège une prévision" is wrong for a month whose prévisions all fit,
    // where the gap comes from money the pace verdict ignores. The last two
    // branches then part on what is pointed: a negative remaining counts every
    // recorded franc, pointed or not, so only the comparison against what the
    // month brings in can claim the deficit for what was pointed.
    //
    // The block returns on every path, which is the point of it: a deficit
    // driven entirely by unpointed entries would otherwise fall through to the
    // percentage below and answer the card's highest-stakes state with
    // reassurance.
    if (this.isPlanOverAvailable()) {
      if (this.planExceedsAvailable())
        return 'dashboard.status.planOverAvailable';
      return moneyDifference(this.realizedExpenses(), this.available()) > 0
        ? 'dashboard.status.outflowBeyondIncome'
        : 'dashboard.status.recordedBeyondIncome';
    }
    if (this.paceStatus() === 'tight') return 'dashboard.status.fastPace';
    // Outside the pace branches, because a plan leaving almost nothing free is
    // true whether or not anything unplanned has happened. Nested inside one,
    // ten francs spent outside an envelope would trade the warning for "ton
    // rythme tient", above a bar still filled to 96%.
    if (this.budgetConsumedPercentage() > this.warningThreshold())
      return 'dashboard.status.almostSpent';
    if (this.paceStatus() === 'on-track') return 'dashboard.status.onTrack';
    // Three states, because the ledger has three: nothing recorded, everything
    // foreseen, and between them a month whose entries the verdict cannot read
    // — an income, or expenses recorded and not yet pointed. That middle one
    // belongs to neither neighbour: nothing has gone out, and what is recorded
    // is precisely what the plan did not foresee.
    if (!this.hasRecordedActivity()) return 'dashboard.status.noPaceYet';
    return this.realizedExpenses() > 0
      ? 'dashboard.status.withinPlan'
      : 'dashboard.status.nothingCheckedYet';
  });

  // Names only itself — what it opens, for which month. The card's contents
  // reach the accessibility tree on their own, so restating them here would read
  // them twice. Dashed off the month rather than joined with "de", which French
  // elides before a vowel: "de août", "de avril", "de octobre".
  protected readonly openMonthAriaLabel = computed(() =>
    this.#transloco.translate('dashboard.openMonthDetail', {
      month: this.periodLabel(),
    }),
  );
}
