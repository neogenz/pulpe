import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  viewChild,
  viewChildren,
} from '@angular/core';

import { MatRipple } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { FinancialKindDirective } from '@ui/financial-kind';
import {
  TransactionIconPipe,
  TransactionLabelPipe,
} from '@ui/transaction-display';
import type { BudgetLineConsumption } from '@core/budget';
import type { BudgetLine, SupportedCurrency } from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';

const MAX_VISIBLE_FORECASTS = 5;
const EXIT_ANIMATION_NAME = 'forecast-check-exit';
const EXIT_ANIMATION_MS = 500;
const EXIT_TIMEOUT_BUFFER_MS = 100;

interface AnimatingForecast {
  forecast: BudgetLine;
  originalIndex: number;
}

@Component({
  selector: 'pulpe-dashboard-unchecked-forecasts',
  imports: [
    MatButtonModule,
    MatRipple,
    MatIconModule,
    AppCurrencyPipe,
    FinancialKindDirective,
    TransactionIconPipe,
    TransactionLabelPipe,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col w-full h-full">
      <!-- gap-3 + min-w-0 + shrink-0 is the whole recipe, and the third card
           built from it (dashboard-next-month) already carries all three.
           Pinning the button without giving the text beside it somewhere to
           shrink leaves the row with no give at all: below a certain card
           width it would overflow rather than reflow. -->
      <!-- Below 360px the button takes its own line — same reason as the twin
           card, which lost that argument by 36px at 320. This title only clears
           by 2px there, and it clears at all because "Prévisions à pointer"
           happens to wrap; one copy edit to a single long word and it would
           read like its twin. -->
      <div
        class="px-1 flex items-center justify-between gap-3 max-[360px]:flex-col max-[360px]:items-start"
        [class.mb-4]="!showsPointerHint()"
        [class.mb-2]="showsPointerHint()"
      >
        <div class="flex items-center gap-3 min-w-0">
          <div
            class="w-10 h-10 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center shrink-0"
          >
            <mat-icon aria-hidden="true">checklist</mat-icon>
          </div>
          <div>
            <h2
              class="text-title-medium font-bold text-on-surface leading-tight"
            >
              {{ 'currentMonth.uncheckedForecasts.title' | transloco }}
            </h2>
            <!-- "Pointer" is this page's central verb and the one house word
                 left undefined on the surface that runs on it — the tour says
                 what it means, and the tour is a screen most people see once,
                 months before they need the answer. At zero the count is the
                 line that can least afford the space: "0 sur 12 pointées"
                 restates the list below it, so the definition below takes its
                 turn until the first check proves it landed, then gets out of
                 the way rather than becoming permanent furniture.
                 A month holding nothing pointable gets neither: the count fell
                 through to "0 sur 0 pointées" and sat above "Tout est à jour",
                 congratulating the user for finishing work that never existed.
                 A month funded entirely from savings goals reaches this, since
                 those lines are filtered out upstream. -->
            @if (totalCount() > 0 && !showsPointerHint()) {
              <p
                class="text-body-small text-on-surface-variant font-medium mt-0.5"
                data-testid="dashboard-forecasts-subtitle"
              >
                @if (totalCount() === 1) {
                  {{
                    'currentMonth.uncheckedForecasts.countSingular'
                      | transloco: { checked: checkedCount() }
                  }}
                } @else {
                  {{
                    'currentMonth.uncheckedForecasts.count'
                      | transloco
                        : { checked: checkedCount(), total: totalCount() }
                  }}
                }
              </p>
            }
          </div>
        </div>
        <!-- Unconditional, like the twin block beside it. Hiding the way out
             once five or fewer remained made two cards built from one header
             recipe behave differently side by side, and the escape hatch costs
             nothing when the list is short. -->
        <!-- The distinction belongs in the visible label, not only in the
             aria-label. Both cards used to read "Voir le budget" and carry
             different accessible names, which fails Label in Name (WCAG 2.5.3,
             level A): a voice-control user saying the words on screen matched
             neither control. It read no better with eyes — two identical text
             buttons at the same optical height in a two-column grid, and the
             answer to "which one do I want" was "either". The aria-label keeps
             the destination the label has no room for. -->
        <!-- The header asks for more width than 375px has, and until now the
             button was one of the two things that gave: at 375 its label wrapped
             to two lines inside a control whose height is fixed at 40, so the
             text measured 42 tall and started a pixel above the button that owns
             it. A title is allowed to wrap; a label sealed in a fixed-height
             button is not. The longer twin label beside it never wrapped, which
             is how a shared header recipe ended up with two different rhythms —
             the squeeze lands on whichever card carries the longer title, not on
             whichever carries the longer label. -->
        <button
          matButton
          class="shrink-0"
          [attr.aria-label]="'currentMonth.viewForecastsInBudget' | transloco"
          (click)="viewBudget.emit()"
        >
          {{ 'currentMonth.viewForecasts' | transloco }}
        </button>
      </div>

      <!-- Full width, below the row rather than inside it. As the subtitle it
           shared the header's text column with a button pinned at shrink-0, so
           the give the column was given landed entirely here: at 375px the one
           sentence teaching this page's central verb was the most cramped thing
           on screen — 126px against the button's 145, five ragged lines. A count
           fits that column because a count is three words. The hero already
           answers this the same way: its gloss is a full-width note under the
           legend, not a fourth key inside it. -->
      @if (showsPointerHint()) {
        <p
          class="text-body-small text-on-surface-variant font-medium mb-4 px-1"
          data-testid="dashboard-forecasts-pointer-hint"
        >
          {{ 'currentMonth.uncheckedForecasts.pointerHint' | transloco }}
        </p>
      }

      <div class="bg-surface-container-low rounded-3xl py-3 px-3 flex-1">
        @if (displayedForecasts().length > 0) {
          <div class="flex flex-col gap-1">
            @for (forecast of displayedForecasts(); track forecast.id) {
              @let displayAmount = remainingToExpect(forecast);
              <!-- Compared as the row prints them, not as they are held. The
                   two figures sit at different precisions on purpose — an
                   aggregation beside a ligne — so 50 centimes off a round 600
                   made them differ in memory and identical on screen: a row
                   flagged as partly consumed reading "600 restant sur 600.00",
                   and a toggle announcing the same contradiction. -->
              @let isPartlyConsumed =
                roundToDisplay(displayAmount) !==
                roundToDisplay(forecast.amount);
              @let isChecking = isExitAnimating(forecast.id);
              <!-- No hover tint on the row: nothing here handles a click. The
                   row lit up under the cursor and then swallowed the click,
                   promising a detail view that does not exist — only the 44px
                   toggle acts, and it carries its own ripple. -->
              <div
                class="relative overflow-hidden flex items-center gap-3 p-3 rounded-2xl"
                [class.checking]="isChecking"
                (animationend)="onExitAnimationEnd(forecast.id, $event)"
                data-testid="dashboard-forecasts-row"
              >
                <!-- Named by the row rather than by an attribute of its own.
                     posthog-js blocks an element from the session replay only
                     through ph-no-capture, that class cannot go on a button
                     because pointer-events: none would make it unclickable,
                     and rrweb serializes the attributes of everything it does
                     not block, whole. So the toggle's name travelled verbatim
                     into the recording while the same name and amount twenty
                     pixels away were correctly withheld. aria-labelledby
                     carries ids, not text: the spoken name is assembled from
                     the very elements the replay already refuses to record. -->
                <button
                  #forecastToggle
                  class="shrink-0 flex items-center justify-center w-11 h-11 -m-2 rounded-full cursor-pointer"
                  matRipple
                  [matRippleCentered]="true"
                  (click)="toggleForecast(forecast.id)"
                  [attr.aria-labelledby]="
                    toggleLabelIds(forecast.id, isPartlyConsumed)
                  "
                  data-testid="dashboard-forecasts-toggle"
                >
                  <span class="sr-only" [id]="'forecast-verb-' + forecast.id">
                    {{
                      'currentMonth.uncheckedForecasts.toggleVerb' | transloco
                    }}
                  </span>
                  <!-- The pair the app already uses for this exact gesture:
                       goal-contributions-list draws the same empty ring for a
                       contribution not yet pointed, and the same filled check
                       once it is. An outlined check here made
                       this the one card wearing the "done" symbol for the not
                       done state, on a list whose title is "Prévisions à
                       pointer" and whose every row is by definition unpointed:
                       a reader scanning it saw five items already handled.
                       The worry that a column of rings reads as "choose one"
                       is real but cheap — it costs one tap to disprove, and
                       these rings carry a name and an amount, not a choice. -->
                  <mat-icon
                    [class.text-primary]="isChecking"
                    [class.icon-filled]="isChecking"
                    aria-hidden="true"
                  >
                    {{ isChecking ? 'check_circle' : 'radio_button_unchecked' }}
                  </mat-icon>
                </button>
                <span
                  class="text-body-medium font-bold text-on-surface truncate flex-1 min-w-0 ph-no-capture"
                  [id]="'forecast-name-' + forecast.id"
                  data-testid="dashboard-forecasts-name"
                >
                  {{ forecast.name }}
                </span>
                <span
                  class="flex items-center gap-1.5 whitespace-nowrap"
                  [pulpeFinancialKind]="forecast.kind"
                >
                  <!-- The tint alone said whether this was money to pay or to
                       collect. The glyph carries it for sighted users, the
                       hidden label for everyone else — mat-icon forces
                       aria-hidden on itself, so it can never be the name. -->
                  <mat-icon class="mat-icon-sm shrink-0" aria-hidden="true">
                    {{ forecast.kind | transactionIcon }}
                  </mat-icon>
                  <span class="sr-only">
                    {{ forecast.kind | transactionLabel }}
                  </span>
                  <span
                    class="text-label-large font-semibold tabular-nums ph-no-capture"
                    [id]="'forecast-amount-' + forecast.id"
                    data-testid="dashboard-forecasts-amount"
                  >
                    {{ displayAmount | appCurrency: currency() : '1.0-0' }}
                  </span>
                  <!-- What the row prints is what the envelope still expects,
                       so a 1'500 rent with 1'400 already allocated read
                       "Loyer 100" — in the same weight and place as an
                       untouched 100 line, with nothing saying the number had
                       moved. The household's largest commitment could appear
                       as its smallest row. The plan is named only when the two
                       differ; on an untouched line it would restate the figure
                       beside it.

                       The clause says which way the ratio runs. A bare "sur"
                       put the pair in the same shape the count above it and
                       the savings card both use for progress — done of total —
                       so "100 sur 1'500.50" read as a rent almost entirely
                       unpaid rather than almost entirely covered, the exact
                       inversion, on the row the user is about to point. -->
                  @if (isPartlyConsumed) {
                    <span
                      class="text-label-small text-on-surface-variant font-medium tabular-nums ph-no-capture"
                      [id]="'forecast-planned-' + forecast.id"
                      data-testid="dashboard-forecasts-planned"
                    >
                      {{
                        'currentMonth.uncheckedForecasts.ofPlanned' | transloco
                      }}
                      <!-- A budget_line amount is a LIGNE, so two decimals: at
                           one, a plan of 1'500.50 was rounded to 1'501 and the
                           row claimed the household owed a franc it did not.
                           The figure beside it stays an aggregation. -->
                      {{ forecast.amount | appCurrency: currency() : '1.2-2' }}
                    </span>
                  }
                </span>
              </div>
            }
          </div>
          @if (hiddenCount() > 0) {
            <!-- The list stops at five and used to stop silently, so a month
                 with ten outstanding forecasts looked like a month with five.
                 The card beside it already learnt this lesson — its subtitle
                 prints the month's total precisely because how many rows are
                 drawn is something the reader can see and how many exist is
                 not. Here the truncation happens at the bottom of the list, so
                 that is where it is said. -->
            <p
              class="text-body-small text-on-surface-variant font-medium text-center pt-3 pb-1"
              data-testid="dashboard-forecasts-hidden-count"
            >
              <!-- No plural resolver is configured for transloco, so the count
                   renders literally — and one is the count this line takes the
                   first month a list of five overflows: "1 autres prévisions
                   ce mois". -->
              @if (hiddenCount() === 1) {
                {{
                  'currentMonth.uncheckedForecasts.hiddenCountSingular'
                    | transloco
                }}
              } @else {
                {{
                  'currentMonth.uncheckedForecasts.hiddenCount'
                    | transloco: { count: hiddenCount() }
                }}
              }
            </p>
          }
        } @else {
          <!-- Focusable so the last check has somewhere to land: clearing the
               final row leaves no toggle button to inherit focus, and the
               reward message is the right thing to read at that moment. -->
          <div
            #emptyState
            tabindex="-1"
            class="p-8 flex flex-col items-center justify-center text-center h-full outline-none"
            data-testid="dashboard-forecasts-empty-state"
          >
            <!-- The subtitle above already refuses to say "0 sur 0 pointées";
                 this branch was still congratulating the same month for
                 finishing work that never existed. Reachable on a first budget
                 built from an empty template, and on any month whose lines all
                 come from savings goals — those are filtered out upstream. -->
            @if (totalCount() > 0) {
              <div
                class="w-16 h-16 rounded-full bg-financial-income/10 text-financial-income flex items-center justify-center mb-4"
              >
                <mat-icon class="scale-150" aria-hidden="true"
                  >done_all</mat-icon
                >
              </div>
              <h3 class="text-title-medium font-medium text-on-surface-variant">
                {{ 'dashboard.allUpToDate' | transloco }}
              </h3>
              <p class="text-body-medium text-on-surface-variant">
                {{
                  'currentMonth.uncheckedForecasts.allCheckedMessage'
                    | transloco
                }}
              </p>
            } @else {
              <div
                class="w-16 h-16 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center mb-4"
              >
                <mat-icon class="scale-150" aria-hidden="true"
                  >event_note</mat-icon
                >
              </div>
              <h3 class="text-title-medium font-medium text-on-surface-variant">
                {{ 'currentMonth.uncheckedForecasts.noneTitle' | transloco }}
              </h3>
              <p class="text-body-medium text-on-surface-variant">
                {{ 'currentMonth.uncheckedForecasts.noneMessage' | transloco }}
              </p>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    @keyframes forecast-check-exit {
      0%,
      30% {
        opacity: 1;
        transform: translateX(0);
      }
      100% {
        opacity: 0;
        transform: translateX(1rem);
      }
    }

    .checking {
      animation: forecast-check-exit 500ms var(--pulpe-ease-emphasized) forwards;
      pointer-events: none;
    }

    @media (prefers-reduced-motion: reduce) {
      .checking {
        animation: forecast-check-exit 1ms forwards;
        opacity: 0.5;
      }
    }
  `,
})
export class DashboardUncheckedForecasts {
  readonly forecasts = input.required<BudgetLine[]>();
  // How many pointable forecasts the month holds in all — `forecasts` only
  // carries the ones still waiting.
  readonly totalCount = input.required<number>();

  // Keyed on whether the user has ever pointed, not on this month's count: the
  // old gate was month-local, so the definition came back every 1st of the
  // month for the rest of the account's life.
  readonly showPointerHint = input(true);
  readonly consumptions = input(new Map<string, BudgetLineConsumption>());

  // The definition and the count share one slot, so three places have to agree
  // on which is showing: the count, the definition, and the gap under the
  // header that closes to bind the definition to it.
  // Gated on the list, not on the month's total: `DASHBOARD_POINTING_LEARNED`
  // is written from this page alone, so a user who points from budget details
  // or from iOS never retires it. Keyed on `totalCount` that user met a card
  // teaching the gesture above "Tout est à jour !", with nothing left to
  // practise it on, and the "12 sur 12 pointées" that would have been the
  // informative line suppressed to make room — permanently, not for one month.
  protected readonly showsPointerHint = computed(
    () => this.forecasts().length > 0 && this.showPointerHint(),
  );

  protected readonly checkedCount = computed(() =>
    Math.max(0, this.totalCount() - this.forecasts().length),
  );
  // What the cap swallows. `displayedForecasts` cannot answer this: it also
  // holds rows on their way out, so during an exit animation it is not the
  // count of what fits.
  protected readonly hiddenCount = computed(() =>
    Math.max(0, this.forecasts().length - MAX_VISIBLE_FORECASTS),
  );
  readonly currency = input<SupportedCurrency>('CHF');
  readonly toggleCheck = output<string>();
  readonly viewBudget = output<void>();

  readonly #destroyRef = inject(DestroyRef);
  readonly #injector = inject(Injector);
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);

  // NG1053 forbids ES-private on view queries.
  private readonly toggleButtons =
    viewChildren<ElementRef<HTMLButtonElement>>('forecastToggle');
  private readonly emptyState =
    viewChild<ElementRef<HTMLElement>>('emptyState');

  // linkedSignal: writable derived state. Computation runs on `forecasts()`
  // change and strips entries whose id has reappeared (rollback). Manual
  // updates (toggle / animation end) persist between source changes.
  readonly #animatingOut = linkedSignal<
    BudgetLine[],
    Map<string, AnimatingForecast>
  >({
    source: this.forecasts,
    computation: (forecasts, prev) => {
      const current = prev?.value ?? new Map<string, AnimatingForecast>();
      if (current.size === 0) return current;
      const visibleIds = new Set(forecasts.map((f) => f.id));
      let stripped: Map<string, AnimatingForecast> | null = null;
      for (const id of current.keys()) {
        if (visibleIds.has(id)) {
          stripped ??= new Map(current);
          stripped.delete(id);
        }
      }
      return stripped ?? current;
    },
  });

  // Per-id safety timer: ensures ghosts always clean up even when
  // `animationend` doesn't fire (iOS Safari edge cases, ghost sliced out
  // of MAX_VISIBLE_FORECASTS, element re-mounted mid-animation, etc.).
  readonly #ghostTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    this.#destroyRef.onDestroy(() => {
      for (const timer of this.#ghostTimers.values()) clearTimeout(timer);
      this.#ghostTimers.clear();
    });
  }

  protected readonly displayedForecasts = computed(() => {
    const list = this.forecasts();
    const animating = this.#animatingOut();
    const visibleList = list.slice(0, MAX_VISIBLE_FORECASTS);

    if (animating.size === 0) return visibleList;

    const visibleIds = new Set(visibleList.map((f) => f.id));
    const ghosts = [...animating.values()]
      .filter(({ forecast }) => !visibleIds.has(forecast.id))
      .toSorted((a, b) => a.originalIndex - b.originalIndex);

    const merged: BudgetLine[] = [...visibleList];
    for (const { forecast, originalIndex } of ghosts) {
      merged.splice(Math.min(originalIndex, merged.length), 0, forecast);
    }
    return merged.slice(0, MAX_VISIBLE_FORECASTS);
  });

  // What the row still expects to see leave. `consumption.remaining` is
  // `amount - consumed` with nothing clamping it, so an envelope of 600 with
  // 650 already allocated against it rendered "Courses −50 CHF" in expense
  // amber, and announced "Pointer Courses — -50 CHF". A negative expense is not
  // a quantity any reader of this list expects. Zero is the true statement —
  // the envelope has nothing left to expect — and it is the reading the budget
  // already applies elsewhere, where a consumed envelope counts as fully used.
  protected remainingToExpect(forecast: BudgetLine): number {
    const consumption = this.consumptions().get(forecast.id);
    return Math.max(0, consumption?.remaining ?? forecast.amount);
  }

  // What the row's leading figure shows: an aggregation, so no centimes.
  protected roundToDisplay(amount: number): number {
    return Math.round(amount);
  }

  protected isExitAnimating(forecastId: string): boolean {
    return this.#animatingOut().has(forecastId);
  }

  // The ids of the elements that spell the toggle's accessible name, in the
  // order they are spoken. The plan is named only when it differs from what the
  // row prints, matching the span that renders it.
  protected toggleLabelIds(
    forecastId: string,
    isPartlyConsumed: boolean,
  ): string {
    const ids = [
      `forecast-verb-${forecastId}`,
      `forecast-name-${forecastId}`,
      `forecast-amount-${forecastId}`,
    ];
    if (isPartlyConsumed) ids.push(`forecast-planned-${forecastId}`);
    return ids.join(' ');
  }

  protected toggleForecast(forecastId: string): void {
    const list = this.forecasts();
    const originalIndex = list.findIndex((f) => f.id === forecastId);
    const forecast = list[originalIndex];
    if (!forecast) return;

    this.#animatingOut.update((current) => {
      const next = new Map(current);
      next.set(forecastId, { forecast, originalIndex });
      return next;
    });
    this.#scheduleGhostCleanup(forecastId);
    this.toggleCheck.emit(forecastId);
  }

  protected onExitAnimationEnd(
    forecastId: string,
    event: AnimationEvent,
  ): void {
    if (event.target !== event.currentTarget) return;
    if (event.animationName !== EXIT_ANIMATION_NAME) return;
    this.#removeGhost(forecastId);
  }

  #scheduleGhostCleanup(forecastId: string): void {
    this.#clearGhostTimer(forecastId);
    const timer = setTimeout(
      () => this.#removeGhost(forecastId),
      EXIT_ANIMATION_MS + EXIT_TIMEOUT_BUFFER_MS,
    );
    this.#ghostTimers.set(forecastId, timer);
  }

  #clearGhostTimer(forecastId: string): void {
    const timer = this.#ghostTimers.get(forecastId);
    if (timer === undefined) return;
    clearTimeout(timer);
    this.#ghostTimers.delete(forecastId);
  }

  #removeGhost(forecastId: string): void {
    this.#clearGhostTimer(forecastId);
    const vacatedIndex = this.#animatingOut().get(forecastId)?.originalIndex;
    this.#animatingOut.update((current) => {
      if (!current.has(forecastId)) return current;
      const next = new Map(current);
      next.delete(forecastId);
      return next;
    });
    if (vacatedIndex !== undefined) this.#restoreFocusAt(vacatedIndex);
  }

  // The button the user was standing on leaves with its row, and the browser
  // drops focus to `<body>` — so a keyboard user has to re-cross the whole page
  // to reach the next line, eighteen times to clear the list. Focus goes to
  // whichever toggle now occupies that slot. A programmatic `focus()` only
  // matches `:focus-visible` when the last interaction was a key press, so a
  // mouse user inherits the tab position without inheriting a ring.
  //
  // What that reasoning missed is the scroll: a bare `focus()` also brings its
  // target into view, and it did so for the mouse and touch user this was meant
  // to be invisible to. Pointing a line from the top of the page threw the
  // reader 290px down it — on the action this page invites most often. So the
  // scroll is asked for separately, and `block: 'nearest'` makes it the no-op
  // it should be whenever the slot is already on screen.
  #focusWithoutScrolling(element: HTMLElement): void {
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: 'nearest' });
  }

  // Only take focus back if this card still holds it. The row leaves up to
  // 600ms after the tap, and the page's primary action is a fixed FAB one tap
  // away: open the sheet inside that window and the amount field takes focus,
  // the numeric keyboard opens, then this fired and threw focus onto a button
  // behind the dialog. The CDK marks background siblings `aria-hidden` rather
  // than `inert`, so they stay focusable and a screen reader lands on a node
  // inside a hidden subtree.
  #stillOwnsFocus(): boolean {
    const active = document.activeElement;
    return (
      active === document.body ||
      active === null ||
      this.#host.nativeElement.contains(active)
    );
  }

  #restoreFocusAt(vacatedIndex: number): void {
    afterNextRender(
      () => {
        if (!this.#stillOwnsFocus()) return;
        const buttons = this.toggleButtons();
        if (buttons.length === 0) {
          const empty = this.emptyState()?.nativeElement;
          if (empty) this.#focusWithoutScrolling(empty);
          return;
        }
        const next =
          buttons[Math.min(vacatedIndex, buttons.length - 1)]?.nativeElement;
        if (next) this.#focusWithoutScrolling(next);
      },
      { injector: this.#injector },
    );
  }
}
