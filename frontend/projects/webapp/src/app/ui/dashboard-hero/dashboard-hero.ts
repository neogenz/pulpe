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
    <!-- A section, not a role="button". The whole card used to be the control,
         and ARIA prunes the roles and names of everything inside a button: the
         month heading vanished from the heading list, the three amounts were
         replaced wholesale by one aria-label carrying only percentages, and the
         "Engagé" explainer below — added because the word needs defining — was
         never announced at all. The card is now a named region that reads out
         normally; the chevron is the real control, and it stretches its own hit
         area back over the card so tapping anywhere still opens the month. -->
    <section
      class="hero-container p-6 pb-5 relative overflow-hidden motion-safe:transition-transform motion-safe:hover:scale-[0.99] dark:border dark:border-white/5"
      [class.budget-over]="isOverBudget()"
      [class.budget-warning]="isWarning()"
      [attr.aria-labelledby]="headingId"
    >
      <!-- The control covers the card, and it has to be a direct child of the
           card to do so: an absolute box resolves against its nearest
           POSITIONED ancestor, and every content row here is relative z-10, so
           a button parked inside one could never reach past that row's own
           box — nor out of the stacking context its z-index opens. Empty on
           purpose: the chevron below is decoration, and a control whose name
           came from its contents would drag the whole card back out of the
           accessibility tree, which is the bug this structure exists to fix. -->
      <button
        type="button"
        class="hero-action"
        [attr.aria-label]="openMonthAriaLabel()"
        (click)="heroClick.emit()"
      ></button>

      <!-- Two decorations left this row: a dot whose colour was inherited from
           a card that already states its condition in full, and two blurred
           orbs DESIGN.md §4 rules out — depth here comes from surface tone, not
           cast light. Neither carried a fact, and the row they sat in is the
           first thing read on the page. -->
      <div class="flex items-center gap-2 mb-6 relative z-10">
        <!-- The visible word is the month, because that is all this card needs
             to say sitting where it sits. Pulled out of the page it needed
             more: this heading also names the whole region, so a heading list
             and a landmark list both offered a bare "août". The qualifier is
             suffixed rather than prefixed to stay clear of the elision French
             would demand of "budget de/d'". -->
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
      <div class="mb-7 relative z-10">
        <div class="flex items-baseline gap-2">
          <!-- tabular-nums, per DESIGN.md:118 — "non-negotiable on hero
               amounts". The legend below has had it all along; the 57px figure
               it belongs to most did not, so the one number the user watches
               through an optimistic write was the one whose digits shifted
               under it. -->
          <!-- The step down on narrow screens matches the app's other amount
               hero: 57px extrabold sits in a nowrap flex row inside a container
               that clips rather than wraps, so a five-figure deficit lost its
               last digits instead of reflowing. The sign is dropped with it —
               the caption below already reads "il manque", and "il manque −500"
               is a shortfall stated twice, once as a word and once as a minus. -->
          <span
            class="font-extrabold text-display-medium sm:text-display-large tracking-tighter leading-none tabular-nums ph-no-capture"
            data-testid="hero-remaining-amount"
          >
            {{ displayedRemaining() | number: '1.0-0' : locale() }}
          </span>
          <!-- 80%, not 70%: at 22px/600 the suffix is too small and too light
               to earn WCAG's large-text exemption, and 70% white over the
               gradient's lightest stop measured 4.00:1. -->
          <span class="text-title-large font-semibold opacity-80">{{
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
        <!-- The ceiling belongs to the number, not to the legend. At the end of
             the keys it never fit: three keys and a denominator ask 347px of the
             295 a 375px screen leaves, so it wrapped alone onto a second line
             and hung there right-aligned under two left-aligned keys. Here the
             whole caption measures 207px, and "disponible sur 4'800" is one
             sentence rather than a key and an orphan. -->
        <!-- The caption follows the sign. Below zero this number is not
             something to spend, it is the gap between the plan and the month,
             and calling it "disponible à dépenser" invited the reader to spend
             a shortfall. The ceiling goes with it: "sur 5'000" reads as the
             budget the figure comes out of, which a shortfall does not. -->
        <!-- Two deficits, two captions. "Il manque pour couvrir ton plan" was
             gated on the deficit alone, and the red state is a deficit — so the
             card told the user their plan was too big directly above a verdict
             telling them it was not, and sent them to trim a prévision when
             every prévision fit. Red is by construction the affordable plan
             that real spending carried past the ceiling; the number under it is
             how far past, not what the plan is short of. -->
        <p class="text-body-small mt-1.5">
          @if (isOverBudget()) {
            {{ 'dashboard.spentBeyondPlan' | transloco }}
          } @else if (isPlanOverAvailable()) {
            <!-- Three deficits, not two. This branch was reached by a negative
                 remaining alone, and remaining counts every franc that has
                 left the account — a 500 transfer to savings against a plan of
                 4'800 on 5'000 of income opens it with 200 of margin to spare.
                 The card then told the user their plan was too big and sent
                 them to trim a prévision, when every prévision fit and the
                 money was deliberately set aside. Blaming the plan requires
                 the plan to be the thing at fault. -->
            @if (planExceedsAvailable()) {
              {{ 'dashboard.missingToCover' | transloco }}
            } @else {
              {{ 'dashboard.missingToBalance' | transloco }}
            }
            <!-- The deficit branch prints no ceiling, so the clause cannot be a
                 share of one — but a negative report is frequently the whole
                 reason the plan does not fit, and dropping it withheld the
                 cause from the one state that needs it. Named as a cause here,
                 as a decomposition in the branch that has a total. -->
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
                 figure it decomposes: the rollover is already part of the
                 4'800, and set beside it as its own clause the line read as a
                 sum of two numbers the reader was invited to add. "dont" says
                 which of the two contains the other. The deficit branch drops
                 the clause entirely — it prints no ceiling, so there is nothing
                 for a share of it to be a share of. -->
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
        <!-- The most consequential sentence on the page, and the one that moves
             without the page moving: recording a transaction flips it from "Ton
             rythme tient." to "Ton budget est presque entièrement engagé."
             in place. A sighted user sees the card change under the tap; a
             screen-reader user heard nothing at all. -->
        <p class="progress-verdict" aria-live="polite">
          {{ statusMessage() | transloco }}
          <!-- The verdict compares spending to how far the month has run, and
               how far the month has run appeared nowhere on the card. "Tu
               dépenses plus vite que le mois ne passe" asked the reader to
               take the second half on trust. Both facts that answer it live
               here, one in days and one in dates: they are that sentence's
               evidence, not a fourth share of the bar, and not — as the
               window used to be — a second time fact three rows above the
               first, standing between the month and the chevron. The window
               still prints only for a period off the calendar month, the case
               where the month name is not enough on its own. -->
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
             the same three shares, so giving the bar a progressbar role would
             read the split twice — and a progressbar can carry one value, not
             three. The legend rows name each share in words and amounts, and
             now that the card is no longer a button, they are read out. -->
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

        <!-- Three keys for three pills, and nothing else: the denominator that
             used to close this row now sits with the number it is a ceiling of.
             What is left is a homogeneous list, so a wrap on a narrow screen
             drops a key under a key instead of stranding a lone right-aligned
             total. -->
        <div class="progress-legend">
          <!-- Ungated, unlike the one below, and it used to share its rule:
               a key for a segment the bar never drew is a swatch pointing at
               nothing. But this is the one figure the verdict above is drawn
               from — it compares what has gone out against how much of the
               month has. Hiding it at zero hid the evidence exactly when it
               was good news, so the card asserted "Ton rythme tient." with
               nothing on screen to check it against, while the aria-label
               spelled out "0% du budget dépensé" to the screen reader. A zero
               here is the reason for the verdict, not the absence of one. -->
          <!-- The ISO code rather than the symbol, and hidden rather than
               drawn: this is the house pattern for the accessible name of an
               amount, and the three keys have no width to spare — the
               denominator was moved out of this row precisely because they
               did not fit with it. Read aloud, the row was three bare
               integers in a product that ships CHF and EUR side by side. -->
          <span class="progress-legend-item">
            <span class="progress-legend-swatch swatch-realized"></span>
            {{ 'dashboard.spent' | transloco }}
            <b class="progress-legend-amount ph-no-capture">
              <span data-testid="hero-spent-amount">{{
                realizedExpenses() | number: '1.0-0' : locale()
              }}</span>
              <span class="sr-only">{{ currency() }}</span>
            </b>
          </span>
          <!-- Gated like the key below it, and for the same reason: a swatch
               pointing at a segment the bar did not draw reads as the track.
               The shares are rounded integers and the amounts are exact, so
               the two disagree in both directions — a month fully pointed
               leaves this key printing "Engagé 0" beside nothing at all. -->
          @if (engagedShare() > 0) {
            <span class="progress-legend-item">
              <span class="progress-legend-swatch swatch-engaged"></span>
              {{ 'dashboard.engaged' | transloco }}
              <b class="progress-legend-amount ph-no-capture">
                <!-- hero-engaged-amount, not hero-expenses-amount: this key
                   carries the share still committed and not yet spent, which
                   is total expenses MINUS what the key beside it shows. Under
                   the old name eight end-to-end assertions read it as the
                   total and compared it against a number it stopped holding. -->
                <span data-testid="hero-engaged-amount">{{
                  engagedNotSpent() | number: '1.0-0' : locale()
                }}</span>
                <span class="sr-only">{{ currency() }}</span>
              </b>
            </span>
          }
          <!-- The outlined pill was the one segment left unnamed, on the
               theory that the card already prints its amount at 57px. It
               doesn't read that way: an outline with no key looks like the
               track the bar sits in rather than a quantity. Same word as the
               caption above the number, so the money in the bar and the money
               in the headline are visibly the same money. -->
          <!-- The only key without an amount, deliberately: this segment's
               figure is the 57px headline forty pixels above, so printing it
               again made a three-key row where two keys carry new facts and one
               repeats the largest number on the card. A legend key needs a name
               and a swatch; the name is what the outline was missing. -->
          @if (freeShare() > 0) {
            <span class="progress-legend-item">
              <span class="progress-legend-swatch swatch-free"></span>
              {{ 'dashboard.available' | transloco }}
            </span>
          }
        </div>

        <!-- Permanent, unlike the gloss under it, and that is the point: the
             gloss retires for good on the first pointing, and this does not.
             Money set aside is the one unambiguously good thing a month
             contains, and on the default view it appeared only inside a key
             whose word means loss — the gloss conceding "épargne comprise"
             instead of showing it, while the card that names it sits behind a
             closed fold. "dont", because it is a part of the figure above and
             not a fourth share of the bar: the bar answers what is left to
             spend, and the composition of one of its parts is a sentence. -->
        @if (realizedSavings() > 0) {
          <p
            class="progress-legend-note ph-no-capture"
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

        <!-- "Engagé" is a house word, and the only place it was ever defined
             was the first-run tour — a screen most people see once, months
             before the first time the number surprises them. Written out rather
             than put behind a tooltip: the card navigates on tap, so a touch
             tooltip would be competing with that gesture for the same finger. -->
        <!-- Gated on the same condition as the key it defines. A month fully
             pointed draws no engagé segment and prints no engagé key, and the
             gloss stayed behind to define a word that had left the card. -->
        <!-- "Déjà sorti" was the one key defined nowhere: not here, not in the
             tour, not in PRODUCT.md's vocabulary — and it is the key whose
             amount a reader most often comes to check. The clause conceding
             that savings were folded in has left this gloss: the line above
             prints them, and a definition that hedges about its own contents
             is worse than one that leaves the arithmetic on screen. -->
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
           32 for a hero — and this card was pinned to the middle one by a
           Tailwind literal, so it read as one more panel among the seven below
           it rather than as the thing the page is about. The token, not the
           literal: the ramp is a rule the page keeps, not a number this file
           happens to hold. */
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

      /* The target is the whole card, so the control is the whole card. z-20
         puts it over the content rows, which all sit at z-10 and would
         otherwise take the click themselves; the container sets no z-index of
         its own, so both live in the same stacking context and the larger
         number simply wins. The orbs need no thought — they carry
         pointer-events: none. */
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

      /* Quiet on purpose: a definition is read once and then never again, so it
         must not compete with the three amounts it explains. 0.72 keeps it at
         4.6:1 on the lightest of the four hero states, above the 4.5:1 the size
         asks for. */
      .progress-legend-note {
        margin: 0.5rem 0 0;
        font-size: var(--mat-sys-label-small-size);
        line-height: var(--mat-sys-label-small-line-height);
        opacity: 0.72;
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
  // The month this card is showing, told rather than guessed. It used to be
  // read off the middle of the period, which works only while the period sits
  // roughly on the calendar month. The convention flips at a payday of 16: below
  // it the period starts in the month it is named after, at and above it the
  // period ends there. So on payday 16 the midpoint lands one month early, and
  // the heading named the wrong month in eleven months out of twelve — under an
  // aria-labelledby that names the whole region, above figures belonging to the
  // month it was not naming.
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
  // A part of `realizedExpenses`, never a sibling of it: the formula behind
  // that input filters on `isOutflowKind`, which admits savings, so what is
  // set aside is already inside the figure this one qualifies. Optional, and
  // zero by default, because a month with nothing set aside has nothing to say
  // here and the line disappears rather than printing a zero.
  readonly realizedSavings = input(0);

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

  // A budget of nothing has no share of itself left to spend. With income and
  // expenses both zero the consumed percentage is 0, so this drew a full-width
  // outlined pill keyed "Disponible" under a 57px "0" captioned "disponible à
  // dépenser sur 0 CHF" — the whole bar claiming a month that does not exist is
  // still the user's to spend.
  // The share arrives already rounded, so a month 22 CHF short of its ceiling
  // reads 100% consumed and this fell to zero: the bar dropped its outlined
  // segment and the legend dropped its "Disponible" key, forty pixels under a
  // headline still printing 22 CHF as available. The amount decides whether the
  // segment exists; the percentage only decides how wide it is, and a franc
  // left is worth a sliver rather than nothing.
  protected readonly freeShare = computed(() => {
    if (this.available() <= 0 || this.remaining() <= 0) return 0;
    return Math.max(
      1,
      FULL_BAR_PERCENT -
        Math.min(this.budgetConsumedPercentage(), FULL_BAR_PERCENT),
    );
  });

  // The colour answers "am I spending too fast?", not "did I plan too much?".
  // It used to answer the second: the percentage it read is
  // (dépenses + épargne planifiées) / (revenus + report), so a month planning
  // 3 500 of expenses and 1 200 of savings against 5 000 of income scored 94%
  // on the 1st with nothing recorded, and the card was amber for thirty days —
  // the tighter the plan, the redder the screen, which puts the alarm on the
  // users who budget best. PRODUCT.md asks for le soulagement avant la
  // pression. The plan is still on the card: it is the "Engagé" key of the
  // legend, and the ceiling beside the headline number.
  // Red is for a month where something really went past its envelope, which is
  // reachable only when the plan itself fits: an affordable plan carried over
  // the ceiling by what actually happened. That is the one case where "ouvre ton
  // budget pour voir ce qui a dépassé" points at something the user can find.
  //
  // It read `realizedExpenses > available`, which is driven entirely by pointing
  // and counts savings among outflow. A plan 100 over its income therefore
  // turned the card red the moment the user pointed it — announcing an overspend
  // for a month where no envelope was exceeded, not one free franc was spent,
  // and a third of the total was money deliberately set aside. The verdict below
  // is built so that pointing a prévision never moves it; this branch outranks
  // that verdict, and undid it.
  readonly planExceedsAvailable = input(false);

  //
  // The deficit alone is not enough to name it. `remaining` counts free savings
  // as outflow, while the plan margin counts only planned lines, so a 500
  // transfer recorded from this page could open the deficit on its own: the
  // card went red and sent the user to "voir ce qui a dépassé" for the money
  // they had just set aside. Red needs something that actually went beyond the
  // plan, which is exactly what a pace verdict other than `within-plan` means.
  readonly isOverBudget = computed(
    () =>
      this.isPlanOverAvailable() &&
      !this.planExceedsAvailable() &&
      this.paceStatus() !== 'within-plan',
  );

  // The plan asks for more than the month has. A negative report alone is
  // enough to put a budget here, and a negative report is a first-class product
  // concept, so this is not an exotic state — it was simply not one the card
  // could reach. It rendered a negative number at 57px on the calm gradient,
  // under a caption that said "disponible à dépenser", beside a sentence
  // hedging that the budget was "presque" entirely committed. The one reading
  // on this page with real stakes was the one delivered in the palette of
  // reassurance.
  // Owned by the page, because retiring the definition is a fact about the
  // user rather than about this month, and `ui/` cannot reach the store that
  // remembers it.
  readonly showEngagedHint = input(true);

  readonly isPlanOverAvailable = computed(() => this.remaining() < 0);

  // The caption carries the sign as a word, so the digits do not carry it
  // again. "Il manque" over "−500" reads as a negative shortfall, which is a
  // surplus; the deficit state was the one reading on the card with real stakes
  // and the only one phrased as a double negative.
  protected readonly displayedRemaining = computed(() =>
    Math.abs(this.remaining()),
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
  // when the month name stops being enough: a payday of 27 makes the period
  // called "février" run from 27 January, so on the 27th the card names a month
  // the user is not in yet, and every figure on the page is scoped to a window
  // that appears nowhere. At the default payday the range would restate the
  // heading, so it says nothing.
  protected readonly periodRange = computed(() => {
    const dates = this.periodDates();
    if (!dates || dates.startDate.getDate() === 1) return '';
    return `${this.#dayMonthFormatter.format(dates.startDate)} – ${this.#dayMonthFormatter.format(dates.endDate)}`;
  });

  // Days rather than the percentage this card already holds: "jour 12 sur 30"
  // is a fact the reader can check against their own calendar, where "40% du
  // mois" is a third number to reconcile with the two beside it. The total is
  // read off the period rather than off that percentage — both bounds are
  // inclusive local midnights, so the subtraction is exact, while the share
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

  // The card answers "am I doing OK?" out loud instead of leaving the user to
  // derive it from two percentages, and it answers it from the ledger. What was
  // recorded outranks what was planned, the reverse of the order this card
  // shipped with: "presque entièrement engagé" is read off a plan that exists
  // whether or not anything has happened, so it was printed every day of every
  // month and the sentence about actual behaviour was never reached.
  protected readonly statusMessage = computed(() => {
    if (this.isOverBudget()) return 'dashboard.status.overBudget';
    // Outranks the pace verdict, because it is not a rate: the month cannot be
    // spent at a speed that makes a plan fit inside an income it already
    // exceeds. Telling someone in deficit that they are spending a little fast
    // names the smaller of the two problems and buries the other.
    // Same split as the caption above: "ouvre ton budget pour alléger une
    // prévision" is an instruction, and it is the wrong one for a month whose
    // prévisions all fit. What opened the gap there is money the pace verdict
    // is built to ignore — a transfer to savings, an expense recorded and not
    // yet pointed — so the sentence names the outflow rather than the plan.
    // "Il est sorti" is this page's word for pointed, and a negative remaining
    // counts every recorded franc whether or not it has been pointed, so the
    // two are not the same reading and the sentence has to pick the one that
    // is true. An expense entered with the toggle off printed "il est sorti
    // plus que ce que le mois t'apporte" directly above a legend reading
    // "Déjà sorti 0"; the comparison against what the month brings in says it
    // exactly, where a bare "something was pointed" also claimed the deficit
    // for fifty francs pointed against three thousand of income.
    //
    // The block returns on every path, which is the point of it. A deficit
    // driven entirely by unpointed entries satisfied none of the earlier
    // conditions and fell through to the percentage below, so the one state on
    // this card with real stakes was answered with "ton budget est presque
    // entièrement engagé" — reassurance, forty pixels under a caption reading
    // "il manque pour équilibrer le mois", and "presque" is false past 100%.
    if (this.isPlanOverAvailable()) {
      if (this.planExceedsAvailable())
        return 'dashboard.status.planOverAvailable';
      return this.realizedExpenses() > this.available()
        ? 'dashboard.status.outflowBeyondIncome'
        : 'dashboard.status.recordedBeyondIncome';
    }
    if (this.paceStatus() === 'tight') return 'dashboard.status.fastPace';
    // A plan leaving almost nothing free is true whether or not anything
    // unplanned has happened, so it cannot live inside one pace branch. It did:
    // ten francs spent outside an envelope moved the month from "within-plan" to
    // "on-track" and replaced "ton budget est presque entièrement engagé" with
    // "ton rythme tient", above a bar still filled to 96%. Spending more turned
    // the warning into reassurance.
    if (this.budgetConsumedPercentage() > this.warningThreshold())
      return 'dashboard.status.almostSpent';
    if (this.paceStatus() === 'on-track') return 'dashboard.status.onTrack';
    // Three states, because the ledger has three. Nothing recorded at all is
    // "rien de saisi". Everything foreseen is the good answer, and the one this
    // card gives for most of a well-run month. Between them sits a month with
    // entries the verdict cannot read — an income, or expenses recorded and not
    // yet pointed — and claiming "tout ce qui est sorti était prévu" there was
    // false twice over: nothing had gone out, and what was recorded was
    // precisely what the plan had not foreseen.
    if (!this.hasRecordedActivity()) return 'dashboard.status.noPaceYet';
    return this.realizedExpenses() > 0
      ? 'dashboard.status.withinPlan'
      : 'dashboard.status.nothingCheckedYet';
  });

  // The label the card used to carry restated its whole contents, because none
  // of those contents reached the accessibility tree. They do now, so the
  // control names only itself: what it opens, and for which month. Dashed off
  // the month rather than joined with "de", which French elides before a vowel:
  // "de août", "de avril" and "de octobre" were three of twelve.
  protected readonly openMonthAriaLabel = computed(() =>
    this.#transloco.translate('dashboard.openMonthDetail', {
      month: this.periodLabel(),
    }),
  );
}
