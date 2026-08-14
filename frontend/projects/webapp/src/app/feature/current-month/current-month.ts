import { format } from 'date-fns';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { formatLocalDate } from '@core/date/format-local-date';
import { LoadingIndicator } from '@core/loading/loading-indicator';
import { ROUTES } from '@core/routing/routes-constants';
import {
  ProductTourService,
  TOUR_START_DELAY,
} from '@core/product-tour/product-tour.service';
import { BaseLoading } from '@ui/loading';
import { StateCard } from '@ui/state-card/state-card';
import {
  transactionCreateFromQuickFormSchema,
  type TransactionFormData,
} from './components/add-transaction-form.schema';
import { DashboardError } from './components/dashboard-error';
import { AddTransactionDialogService } from './services/add-transaction-dialog.service';
import { DashboardStore } from './services/dashboard-store';

import { DashboardHero } from '@ui/dashboard-hero/dashboard-hero';
import { DashboardUncheckedForecasts } from './components/dashboard-unchecked-forecasts';
import { DashboardHistoryChart } from './components/dashboard-history-chart';
import { DashboardFutureProjectionChart } from './components/dashboard-future-projection-chart';
import { DashboardRecentTransactions } from './components/dashboard-recent-transactions';
import { DashboardSavingsSummary } from './components/dashboard-savings-summary';
import { DashboardNextMonth } from './components/dashboard-next-month';
import { UserSettingsStore } from '@core/user-settings';
import { CURRENCY_CONFIG } from '@core/currency';
import { dateFnsLocaleFor } from '@core/locale';
import { StorageService, STORAGE_KEYS } from '@core/storage';

// Longer than the plain notification below: this toast is not read, it is
// reached. It has to survive the user noticing the mistake and travelling to
// the button.
export const UNDO_WINDOW_MS = 6000;

// Both toasts below quote something the user typed — a prévision's name, a
// transaction's — and a snackbar renders in the CDK overlay, outside every
// subtree this app has marked. posthog-js hardcodes `ph-no-capture` as rrweb's
// blockClass, and it is the only thing keeping rendered text out of a session
// replay, so "Enregistré : Consultation Dr Martin" was travelling verbatim.
// `amounts-visible` is the documented escape from the blur rule that shares the
// class: without it the hide-amounts toggle would blur the toast and, through
// `pointer-events: none`, take the Undo button with it.
const NAMED_TOAST_PANEL_CLASS = ['ph-no-capture', 'amounts-visible'];

// The two things this page writes, and the two ways it takes them back.
type UndoableAction =
  | { readonly kind: 'check'; readonly id: string; readonly name: string }
  | {
      readonly kind: 'transaction';
      readonly id: string;
      readonly name: string;
    };

@Component({
  selector: 'pulpe-dashboard',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    DashboardError,
    BaseLoading,
    StateCard,
    TranslocoPipe,
    DashboardHero,
    DashboardUncheckedForecasts,
    DashboardRecentTransactions,
    DashboardSavingsSummary,
    DashboardNextMonth,
    DashboardHistoryChart,
    DashboardFutureProjectionChart,
  ],
  template: `
    <div class="flex flex-col gap-4 min-w-0" data-testid="dashboard-page">
      <header class="pulpe-page-header" data-testid="page-header">
        <h1
          class="text-headline-medium md:text-display-small font-bold truncate min-w-0 shrink pb-0"
          data-testid="page-title"
        >
          {{ 'currentMonth.pageTitle' | transloco }}
        </h1>
        <div class="flex gap-2 items-center shrink-0 ml-auto">
          <!-- The tour teaches what "Engagé" and "Pointer" mean, and until now
               the only way back to it was the account menu — three taps behind
               an avatar, where nobody looks for help about the page they are
               on. The words it explains are all on this screen; so is the
               button now. -->
          <button
            matIconButton
            (click)="openPageHelp($event)"
            [matTooltip]="'navigation.discoverPage' | transloco"
            [attr.aria-label]="'navigation.discoverPage' | transloco"
            data-testid="page-help-button"
          >
            <mat-icon aria-hidden="true">help_outline</mat-icon>
          </button>
          <!-- disabledInteractive keeps the element focusable while it is
               disabled. Material emits the native attribute otherwise, and the
               browser drops focus to the document body the instant the button is
               pressed — so a keyboard user was returned to the top of the page
               on every refresh and had to traverse the header again to press it
               a second time. -->
          <button
            matIconButton
            (click)="refresh()"
            [disabled]="store.isLoading()"
            [disabledInteractive]="true"
            [matTooltip]="'currentMonth.refresh' | transloco"
            [attr.aria-label]="'currentMonth.refresh' | transloco"
            data-testid="refresh-button"
          >
            <mat-icon aria-hidden="true">refresh</mat-icon>
          </button>
        </div>
      </header>

      @if (store.isInitialLoading()) {
        <pulpe-base-loading
          [message]="'currentMonth.loadingMessage' | transloco"
          size="large"
          testId="dashboard-loading"
        />
      } @else if (store.dashboardData()?.budget) {
        <div class="flex flex-col gap-8">
          <!-- Hero "Disponible à dépenser" -->
          <pulpe-dashboard-hero
            [expenses]="store.totalExpenses()"
            [available]="store.totalAvailable()"
            [remaining]="store.remaining()"
            [budgetConsumedPercentage]="store.budgetConsumedPercentage()"
            [realizedExpenses]="store.realizedExpenses()"
            [realizedSavings]="store.totalSavingsRealized()"
            [realizedPercentage]="store.realizedPercentage()"
            [periodDates]="store.periodDates()"
            [period]="store.currentBudgetPeriod()"
            [rolloverAmount]="store.rolloverAmount()"
            [elapsedDayOfPeriod]="store.elapsedDayOfPeriod()"
            [paceStatus]="store.paceStatus()"
            [planExceedsAvailable]="store.isPlanBeyondAvailable()"
            [hasRecordedActivity]="store.hasRecordedActivity()"
            [showEngagedHint]="showPointingHints()"
            [currency]="currency()"
            [locale]="currencyLocale()"
            (heroClick)="navigateToBudgetDetails()"
            data-testid="dashboard-block-hero"
            data-tour="dashboard-hero"
          />

          <!-- Fixed, so its place in the markup costs nothing visually and buys
               the tab order: recording a transaction is what this page is for,
               and it used to be the fourteenth stop of fifteen — behind every
               row of every list. It now follows the month's verdict, which is
               also the order a screen reader reads them in. -->
          <button
            matFab
            extended
            (click)="openAddTransaction()"
            class="fab-button"
            data-testid="add-transaction-fab"
            data-tour="add-transaction-fab"
          >
            <mat-icon aria-hidden="true">add</mat-icon>
            {{ 'currentMonth.addTransactionFab' | transloco }}
          </button>

          <!-- The month's open work. The list with a button on every row leads;
               the CSS order utilities used to put it second on desktop and
               first on mobile, which both buried the one actionable block
               behind a read-out and left the mobile reading order disagreeing
               with the tab order. -->
          <div
            class="dashboard-action-lists grid grid-cols-1 lg:grid-cols-2 gap-6"
            data-tour="dashboard-lists"
          >
            <pulpe-dashboard-unchecked-forecasts
              [forecasts]="store.uncheckedForecasts()"
              [totalCount]="store.forecastsTotalCount()"
              [showPointerHint]="showPointingHints()"
              [consumptions]="store.consumptions()"
              [currency]="currency()"
              (toggleCheck)="checkBudgetLine($event)"
              (viewBudget)="navigateToBudgetDetails()"
              data-testid="dashboard-block-forecasts"
            />

            <pulpe-dashboard-recent-transactions
              [transactions]="store.recentTransactions()"
              [totalCount]="store.transactions().length"
              (viewBudget)="navigateToBudgetDetails()"
              (addTransaction)="openAddTransaction()"
              data-testid="dashboard-block-recent-transactions"
            />
          </div>
        </div>

        <!-- Everything below is read, not acted on: the months ahead, the
             months behind, and how the savings are tracking. It is folded away
             because PRODUCT.md names two different visits — the quick daily
             check and the deeper planning session — and the page used to serve
             both at once, ending the daily one a quarter of the way down and
             then asking for four more screens of things nobody can act on. The
             fold remembers its state, so the planning session opens it once.
             Closed, the charts inside are display:none, so the viewport
             trigger that mounts them never fires — the other half of the cost
             this removes. -->
        <!-- The title has to sit outside the summary to stay a heading at all.
             A summary maps to a button, and ARIA prunes the roles of a
             button's descendants — the same rule the hero documents fixing at
             its own month heading. Four of this page's seven blocks live
             behind this control, and its name was missing from the heading
             list entirely: navigating by heading went from the transactions
             card to nothing, since the four headings inside are hidden while
             the fold is closed. The visible copy stays where it is, so the
             control keeps its name and its look. -->
        <h2 class="sr-only">{{ 'currentMonth.outlookTitle' | transloco }}</h2>
        <details
          #outlookDetails
          class="dashboard-outlook"
          [open]="isOutlookExpanded()"
          (toggle)="syncOutlookExpanded(outlookDetails.open)"
        >
          <summary
            class="outlook-summary"
            data-testid="dashboard-outlook-summary"
          >
            <div class="min-w-0">
              <p
                class="text-title-medium font-bold text-on-surface leading-tight"
              >
                {{ 'currentMonth.outlookTitle' | transloco }}
              </p>
              <p
                class="text-body-small text-on-surface-variant font-medium mt-0.5"
              >
                {{ 'currentMonth.outlookHint' | transloco }}
              </p>
            </div>
            <mat-icon class="outlook-chevron shrink-0" aria-hidden="true"
              >expand_more</mat-icon
            >
          </summary>

          <div class="flex flex-col gap-6 pt-6">
            <!-- Future Projection Chart -->
            @defer (on viewport; prefetch on idle) {
              <pulpe-dashboard-future-projection-chart
                [forecasts]="store.upcomingBudgetsData()"
                [hasError]="store.historyError() !== undefined"
                (createMissingBudgets)="navigateToBudgetList()"
                (retry)="store.refreshData()"
                data-testid="dashboard-block-projection"
              />
            } @placeholder {
              <div
                class="bg-surface-container-low rounded-3xl min-h-[300px]"
              ></div>
            } @loading (after 100ms; minimum 300ms) {
              <div
                class="bg-surface-container-low rounded-3xl min-h-[300px] flex items-center justify-center"
              >
                <pulpe-base-loading
                  [message]="'currentMonth.chartLoading' | transloco"
                  size="medium"
                  testId="projection-chart-loading"
                />
              </div>
            }

            <!-- Paired metrics: Savings Summary + Next Month -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <pulpe-dashboard-savings-summary
                [totalPlanned]="store.totalSavingsPlanned()"
                [totalRealized]="store.totalSavingsRealized()"
                [checkedCount]="store.savingsCheckedCount()"
                [totalCount]="store.savingsTotalCount()"
                [allLinesPointed]="store.areSavingsFullyPointed()"
                [currency]="currency()"
                (viewSavingsGoals)="navigateToSavingsGoals()"
                data-testid="dashboard-block-savings"
              />

              <!-- The card is told the request failed instead of being swapped
                 for a different one. A dead history request reaches it as a
                 fully-populated twelve months either way — the list is filled
                 unconditionally — so "Pas encore de budget pour septembre" was
                 the branch it took, inviting the user to build a month they
                 had already planned, while the chart twenty pixels away
                 correctly said it could not load. Same request, two claims. -->
              <pulpe-dashboard-next-month
                [forecast]="store.upcomingBudgetsData()[0]"
                [estimatedRollover]="store.remaining()"
                [hasError]="store.historyError() !== undefined"
                [currency]="currency()"
                (navigateToBudgets)="navigateToBudgetList()"
                (retry)="store.refreshData()"
                data-testid="dashboard-block-next-month"
              />
            </div>

            <!-- History Chart -->
            @defer (on viewport; prefetch on idle) {
              <pulpe-dashboard-history-chart
                [history]="store.historyData()"
                [hasError]="store.historyError() !== undefined"
                (retry)="store.refreshData()"
                data-testid="dashboard-block-history"
              />
            } @placeholder {
              <div
                class="bg-surface-container-low rounded-3xl min-h-[300px]"
              ></div>
            } @loading (after 100ms; minimum 300ms) {
              <div
                class="bg-surface-container-low rounded-3xl min-h-[300px] flex items-center justify-center"
              >
                <pulpe-base-loading
                  [message]="'currentMonth.chartLoading' | transloco"
                  size="medium"
                  testId="history-chart-loading"
                />
              </div>
            }
          </div>
        </details>
      } @else if (store.error() && !store.dashboardData()) {
        <!-- Reached only with nothing to show, because the data is asked about
             first now and the order is the fix. The cache hands back the last
             good payload whatever the status is — a snapshot wins over the
             resource value, and only its absence falls through to the default
             — so a dropped reload left the page fully loaded in memory and
             still swapped it for "On n'arrive pas à charger ton tableau de
             bord". Every check and every added transaction invalidates this
             resource, so the gesture most likely to be repeated was also the
             one most likely to throw the screen away. The store already
             refuses to let the history request blank a page whose figures
             loaded; it was doing it to itself. The refresh toast carries the
             failure now.

             "Nothing to show" is the absence of a payload, not the absence of
             a budget inside one. Testing only the branch above let a month
             with no budget — a real, cached, correctly loaded payload holding
             a null budget — lose its "Pas encore de budget" card and its way
             out to the budget list the moment any reload failed, which on this
             page is every check and every transaction.

             It asks whether there IS a failure, not whether the dashboard
             request is the one that failed. Settings are now a way this page
             breaks, and the store deliberately never fires the dashboard
             request without them — so that resource sits at "idle", the status
             test was false, and a failed settings load fell through to the
             branch below and told the user, flatly, that they had no budget
             this month. That claim was not merely unhelpful: it offers to
             create a budget that already exists. -->
        <pulpe-dashboard-error
          [message]="store.loadErrorMessage()"
          (reload)="store.refreshData()"
          data-testid="dashboard-error"
        />
      } @else {
        <pulpe-state-card
          variant="empty"
          testId="empty-state"
          [title]="
            'currentMonth.noBudgetTitle'
              | transloco: { period: budgetPeriodDisplayName() }
          "
          [message]="'currentMonth.noBudgetMessage' | transloco"
          [actionLabel]="'currentMonth.viewBudgets' | transloco"
          (action)="navigateToBudgetList()"
        />
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      padding-bottom: 100px;
    }

    /* The hero closes the monthly summary; the lists below begin the work still
       waiting for the user. A tonal rule and one medium section step make that
       change of purpose visible without wrapping either block in another card. */
    .dashboard-action-lists {
      padding-top: var(--pulpe-section-gap-md);
      border-top: var(--pulpe-surface-border-subtle);
    }

    /* The break between what the month asks of you and what it reports back.
       The gap alone could not carry it: every interval on this page was already
       24 or 32px, so one more of either read as another sibling rather than as
       a change of subject. */
    .dashboard-outlook {
      margin-top: var(--pulpe-section-gap-lg);
      padding-top: var(--pulpe-section-gap-lg);
      border-top: var(--pulpe-surface-border-subtle);
    }

    /* The native disclosure, minus its marker: <details> already carries the
       keyboard handling, the expanded state and the announcement, and none of
       that is worth re-implementing on a button and an @if. */
    .outlook-summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      min-height: 64px;
      padding: 14px 16px;
      border-radius: var(--pulpe-surface-radius-card);
      cursor: pointer;
      list-style: none;
    }

    .outlook-summary::-webkit-details-marker {
      display: none;
    }

    /* The gate to four of the page's seven blocks, and at rest it was a heading
       with a decorative chevron on the page background — no border, no surface,
       nothing that answered a pointer. The chart card two files over had the
       same problem and the same fix. */
    @media (hover: hover) {
      .outlook-summary:hover {
        background: color-mix(
          in srgb,
          var(--mat-sys-on-surface) 8%,
          transparent
        );
      }
    }

    .outlook-summary:active {
      background: color-mix(
        in srgb,
        var(--mat-sys-on-surface) 12%,
        transparent
      );
    }

    .outlook-summary:focus-visible {
      outline: 3px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }

    .outlook-chevron {
      color: var(--mat-sys-on-surface-variant);
    }

    .dashboard-outlook[open] .outlook-chevron {
      transform: rotate(180deg);
    }

    @media (prefers-reduced-motion: no-preference) {
      .outlook-chevron {
        transition: transform var(--pulpe-motion-standard, 200ms) ease;
      }
    }

    /* Étendu, et pas rond : le « + » seul ne disait pas ce qu'il ouvrait, alors
       que c'est le premier endroit où le verbe se lit — avant même le titre du
       formulaire. Il recouvre un peu du contenu en bas de page, ce qui est le
       prix consenti pour cela. Material tient la géométrie de la variante
       étendue (hauteur 56, corner-large), il n'y a donc rien à figer ici. */
    .fab-button {
      position: fixed;
      bottom: calc(24px + env(safe-area-inset-bottom));
      right: 24px;
      z-index: 100;

      /* Flat. DESIGN.md gives the gradient to the hero and to nothing else —
         the rest of the system is flat surface or hairline border — and this
         button floats over the content zone, forty pixels from a card that
         obeys that rule. */
      --mat-fab-container-color: var(--mat-sys-primary);
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);

      box-shadow: var(--mat-sys-level3);

      transition:
        transform 200ms var(--pulpe-ease-emphasized),
        box-shadow 200ms var(--pulpe-ease-emphasized);

      animation: fab-scale-in var(--pulpe-motion-base)
        var(--pulpe-ease-emphasized) both;

      &:hover {
        transform: scale(1.05);
        box-shadow: var(--mat-sys-level4);
      }

      &:active {
        transform: scale(0.95);
        box-shadow: var(--mat-sys-level1);
        transition-duration: 100ms;
      }
    }

    @keyframes fab-scale-in {
      0% {
        transform: scale(0);
        opacity: 0;
      }
      70% {
        transform: scale(1.08);
        opacity: 1;
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .fab-button {
        animation: none;
        transition: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Dashboard {
  protected readonly store = inject(DashboardStore);
  protected readonly currency = inject(UserSettingsStore).currency;
  protected readonly locale = inject(UserSettingsStore).locale;
  protected readonly currencyLocale = computed(
    () => CURRENCY_CONFIG[this.currency()].numberLocale,
  );
  readonly #productTourService = inject(ProductTourService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #loadingIndicator = inject(LoadingIndicator);
  readonly #addTransactionDialog = inject(AddTransactionDialogService);
  readonly #router = inject(Router);
  readonly #snackBar = inject(MatSnackBar);
  readonly #transloco = inject(TranslocoService);
  readonly #storage = inject(StorageService);
  readonly #refreshPhase = signal<'idle' | 'requested' | 'running'>('idle');

  // Folded by default: the daily visit is the one this page is for, and it ends
  // at the rule. Unfolding is remembered, so a planning session pays for it once
  // rather than every month.
  readonly #outlookExpanded = signal(
    this.#storage.get<boolean>(STORAGE_KEYS.DASHBOARD_OUTLOOK_EXPANDED) ??
      false,
  );
  protected readonly isOutlookExpanded = this.#outlookExpanded.asReadonly();

  // The template hands the state in off its own reference variable, rather than
  // this reading it back through a view query: `Event.target` is an
  // `EventTarget` and would need a cast to admit `open`, and a view query would
  // make the handler untestable without a full render of this page.
  // The write is what makes the comment above true — Dashboard is the route
  // component, so it is destroyed on every navigation and a signal alone lasts
  // exactly as long as the visit that opened it.
  protected syncOutlookExpanded(isExpanded: boolean): void {
    this.#outlookExpanded.set(isExpanded);
    this.#storage.set(STORAGE_KEYS.DASHBOARD_OUTLOOK_EXPANDED, isExpanded);
  }

  // "Engagé" and "Pointer" are this page's two house words, and each carries a
  // printed definition on the card that uses it. Both were retiring on the
  // wrong clock: the hero's showed whenever an engagé segment existed, which is
  // most months forever, and the forecasts card's came back every 1st of the
  // month because it keyed on the current month's check count. On a surface
  // built for a ten-second daily check, that made two lines of teaching copy
  // permanent furniture on the two most important cards. One gesture retires
  // both — the user who has pointed a line has been taught what pointing is,
  // and what leaves "engagé" when they do it.
  readonly #pointingLearned = signal(
    this.#storage.get<boolean>(STORAGE_KEYS.DASHBOARD_POINTING_LEARNED) ??
      false,
  );
  protected readonly showPointingHints = computed(
    () => !this.#pointingLearned(),
  );

  #recordPointingLearned(): void {
    if (this.#pointingLearned()) return;
    this.#pointingLearned.set(true);
    this.#storage.set(STORAGE_KEYS.DASHBOARD_POINTING_LEARNED, true);
  }
  // What one toast can still take back. A second action used to replace the
  // first toast and, with it, the only way back to the first thing done —
  // pointing three lines quickly left two of them stranded.
  //
  // One list rather than one per kind, because Material shows a single
  // snackbar and the two undo paths were competing for it. Recording a
  // transaction and then pointing a forecast is the ordinary rhythm of
  // clearing a month, and whichever came second silently killed the first
  // one's way back — the transaction case being the expensive one, since a
  // mistyped amount then has to be hunted down on another page. A window that
  // holds both is the model; guarding each caller against the other is not.
  #undoableActions: UndoableAction[] = [];
  #undoWindowTimeout: ReturnType<typeof setTimeout> | null = null;

  // The only month name on this page that was not driven by the user's own
  // locale. Every other one goes through LOCALE_ID, which `core/locale.ts`
  // derives from the currency, and it ships `dateFnsLocaleFor` for exactly this
  // call. `frCH` and `fr` happen to render `MMMM yyyy` identically today, so
  // nothing was visibly wrong — it was one date-fns release away from being the
  // odd string out.
  protected readonly budgetPeriodDisplayName = computed(() => {
    const period = this.store.currentBudgetPeriod();
    return format(new Date(period.year, period.month - 1, 1), 'MMMM yyyy', {
      locale: dateFnsLocaleFor(this.locale(), this.currency()),
    });
  });

  constructor() {
    effect(() => {
      const status = this.store.status();
      this.#loadingIndicator.setLoading(status === 'reloading');
    });

    // Nothing on this page changes when the figures come back unchanged, which
    // is the common case — so pressing Actualiser looked exactly like pressing
    // a dead button. The two phases matter: confirming on the first quiet tick
    // would fire before the reload had even started.
    effect(() => {
      // The verdict below reads `historyError()`, so it has to wait for the
      // request that would set it. `store.isLoading()` deliberately excludes
      // history, and settling on it alone judged the outcome while the history
      // call was still in flight — and a failing call is by construction slower
      // than a succeeding one. The toast said "Chiffres à jour" and two cards
      // turned to "indisponible" underneath it a second later.
      const isLoading =
        this.store.isLoading() ||
        (this.isOutlookExpanded() && this.store.isHistoryLoading());
      const phase = untracked(this.#refreshPhase);
      if (phase === 'idle') return;
      if (isLoading) {
        this.#refreshPhase.set('running');
        return;
      }
      if (phase === 'running') {
        this.#refreshPhase.set('idle');
        // isLoading() falls on failure exactly as it falls on success, so the
        // quiet tick alone said nothing about the outcome: a dead connection
        // drew the full-page error card AND a toast claiming the figures were
        // up to date. One gesture, two contradictory answers. The milder case
        // was the common one — isLoading() ORs in the history resource, so a
        // dashboard that reloaded fine while history died still congratulated
        // itself over two cards reading "indisponible".
        // The history half only counts while the fold is open. Every consumer
        // of historyError() lives inside it, and it defaults closed, so a dead
        // history endpoint on the daily visit produced no visible symptom and
        // a toast saying "Impossible de tout recharger" — a failure the user
        // cannot see, diagnose or act on, reproduced on every retry. The
        // reasoning above still holds for the planning visit, where those two
        // cards are on screen reading "indisponible".
        const failed =
          !!this.store.error() ||
          (this.isOutlookExpanded() && !!this.store.historyError());
        this.#notify(
          this.#transloco.translate(
            failed ? 'currentMonth.refreshFailed' : 'currentMonth.refreshed',
          ),
        );
      }
    });

    this.#destroyRef.onDestroy(() => {
      this.#loadingIndicator.setLoading(false);
      this.#closeUndoWindow();
    });

    afterNextRender(() => {
      const tourTimeout = setTimeout(
        () => this.#productTourService.startFirstRunTour(),
        TOUR_START_DELAY,
      );
      this.#destroyRef.onDestroy(() => clearTimeout(tourTimeout));
    });
  }

  // Guarded on the same condition the greyed button already claims, because
  // `disabledInteractive` keeps it clickable on purpose: Material emits no
  // native `disabled` attribute under that flag and installs its click-halt
  // only on anchors, so `[disabled]` greys the control and nothing more.
  //
  // It has to be `isLoading`, not the phase. `resource.reload()` returns false
  // and does nothing while a load is already in flight, so a press landing on a
  // background refetch armed the phase over a reload that never started:
  // `isLoading()` never changed value, the effect below never re-ran, and when
  // the load finally settled the phase matched no branch and stayed at
  // 'requested' — the one state 'idle' is never restored from. Guarding on the
  // phase then made that permanent, killing the button for the rest of the
  // visit and leaving an armed phase to fire on the next unrelated reload,
  // where it replaced whatever toast held the screen. Undo toasts live there.
  protected refresh(): void {
    // Returning in silence was the one press on this page that produced
    // nothing at all: `disabledInteractive` keeps the control clickable, so the
    // ripple fired, the tooltip said "Actualiser", and the answer was a grey
    // tint identical to the one it wears during a refresh the user did start.
    // The reload is already running — that is a status, and this page states
    // its statuses.
    if (this.store.isLoading()) {
      this.#notify(
        this.#transloco.translate('currentMonth.refreshAlreadyRunning'),
      );
      return;
    }
    this.#refreshPhase.set('requested');
    this.store.refreshData();
  }

  protected openPageHelp(event: Event): void {
    const trigger =
      event.currentTarget instanceof HTMLElement
        ? event.currentTarget
        : undefined;
    this.#productTourService.startPageTour('dashboard', trigger);
  }

  protected navigateToBudgetDetails(): void {
    const budgetId = this.store.dashboardData()?.budget?.id;
    if (budgetId) {
      this.#router.navigate(['/budget', budgetId]);
    }
  }

  protected navigateToBudgetList(): void {
    this.#router.navigate(['/', ROUTES.BUDGET]);
  }

  protected navigateToSavingsGoals(): void {
    this.#router.navigate(['/', ROUTES.SAVINGS_GOALS]);
  }

  protected async checkBudgetLine(budgetLineId: string): Promise<void> {
    // Read before the mutation: a pointed line leaves `uncheckedForecasts`, so
    // afterwards there is no name left to put in the message.
    const name = this.store
      .uncheckedForecasts()
      .find((line) => line.id === budgetLineId)?.name;

    const refusal = await this.store.checkBudgetLine(budgetLineId);
    if (refusal) {
      this.#notify(refusal);
      return;
    }
    // Undefined means the store treated this as a no-op — a second tap on a
    // line already gone. Nothing happened, so nothing is confirmed or undone.
    if (name === undefined) return;

    this.#confirmWithUndo({ kind: 'check', id: budgetLineId, name });
  }

  // The confirmation and the way back are one object. The toast's own live
  // region is what tells a screen reader the write landed — until now the
  // action was silent — and its button is the only reversal available here,
  // since a pointed line leaves the page and takes its own toggle with it, and
  // a transaction recorded from the sheet has to be hunted down on another page
  // to be removed.
  //
  // Which is why it accumulates. Clearing a month means several writes in a
  // row, and each toast replaced the one before it: six seconds after the
  // first tap the first one was no longer recoverable, though the user was
  // still on the same run. The window restarts on every write and covers all
  // of them, whichever kind they are.
  #confirmWithUndo(action: UndoableAction): void {
    this.#undoableActions = [...this.#undoableActions, action];
    const actions = this.#undoableActions;

    const ref = this.#snackBar.open(
      this.#undoWindowMessage(actions),
      // The action reverts everything in the window, and a bare "Annuler"
      // beside "2 prévisions pointées" reads as undoing the tap that opened
      // the toast. A user correcting their second tap lost their first, and
      // had to find it again in a list they may have to scroll or leave the
      // page to reach. The label says its scope once there is more than one.
      actions.length === 1
        ? this.#transloco.translate('common.undo')
        : this.#transloco.translate('currentMonth.undoAll', {
            count: actions.length,
          }),
      {
        duration: UNDO_WINDOW_MS,
        politeness: 'polite',
        panelClass: NAMED_TOAST_PANEL_CLASS,
      },
    );
    ref.onAction().subscribe(() => {
      this.#closeUndoWindow();
      void this.#undoActions(actions);
    });

    // The toast's own duration cannot own this: taking the undo, or another
    // action opening a new toast, both dismiss it without saying which
    // happened.
    //
    // The glossaries retire here rather than at the tap, because this is the
    // first point at which the check is a fact. Recorded straight after the
    // mutation, a check the user immediately undid still retired them for
    // good — and both cards dropped their teaching copy while the row was
    // still animating out, so roughly 70px vanished from under the finger at
    // the exact moment the product was teaching the gesture. Leaving the page
    // inside the window clears the timeout and leaves the hints for next time,
    // which is the harmless direction to be wrong in. A window holding only
    // transactions has taught nothing about pointing and retires nothing.
    if (this.#undoWindowTimeout) clearTimeout(this.#undoWindowTimeout);
    this.#undoWindowTimeout = setTimeout(
      () => this.#settleUndoWindow(),
      UNDO_WINDOW_MS,
    );
  }

  // The window is over and what it covered is now a fact. Time is one way to
  // get here; losing the snackbar to another message is the other.
  #settleUndoWindow(): void {
    if (this.#undoableActions.some((entry) => entry.kind === 'check'))
      this.#recordPointingLearned();
    this.#closeUndoWindow();
  }

  // Each kind keeps its own sentence for as long as the window holds only that
  // kind, because "Pointé : Loyer" and "Enregistré : Courses" say what moved.
  // A window holding both can only count them.
  #undoWindowMessage(actions: readonly UndoableAction[]): string {
    const checks = actions.filter((entry) => entry.kind === 'check');
    const message = this.#undoWindowHeadline(actions, checks.length);
    if (checks.length === 0) return message;

    // The toast reports what the check actually moved, which is how many
    // forecasts are left to point — not the money. "Disponible" is
    // available − Σ max(line.amount, consumed): the envelope counts the plan
    // whether or not it has been pointed, so checking a line leaves that
    // figure exactly where it was. Printing it here gave five identical
    // numbers over five taps and read as a counter that had jammed.
    const left = this.store.uncheckedForecasts().length;
    if (left === 0) return message;
    return `${message} — ${this.#transloco.translate('currentMonth.uncheckedForecasts.stillToCheck', { count: left })}`;
  }

  #undoWindowHeadline(
    actions: readonly UndoableAction[],
    checkCount: number,
  ): string {
    if (actions.length === 1) {
      const [only] = actions;
      return this.#transloco.translate(
        only.kind === 'check'
          ? 'currentMonth.uncheckedForecasts.checked'
          : 'currentMonth.transactionAdded',
        { name: only.name },
      );
    }
    if (checkCount === actions.length)
      return this.#transloco.translate(
        'currentMonth.uncheckedForecasts.checkedMany',
        { count: actions.length },
      );
    if (checkCount === 0)
      return this.#transloco.translate('currentMonth.transactionAddedMany', {
        count: actions.length,
      });
    return this.#transloco.translate('currentMonth.undoWindowMixed', {
      count: actions.length,
    });
  }

  #closeUndoWindow(): void {
    this.#undoableActions = [];
    if (this.#undoWindowTimeout) {
      clearTimeout(this.#undoWindowTimeout);
      this.#undoWindowTimeout = null;
    }
  }

  // Sequential, not parallel: each reversal recomputes the month server-side,
  // and the store patches one entity at a time. Reversed so the month walks
  // back the way it came.
  //
  // Every entry is attempted, and the report counts what refused. Returning at
  // the first refusal abandoned the rest of the window silently — the toast was
  // already gone and the list already emptied — so "Annuler les 3" could revert
  // one, leave two pointed, and announce it in the singular. The refusals are
  // independent server calls; one saying no is no reason to stop asking.
  async #undoActions(actions: readonly UndoableAction[]): Promise<void> {
    let firstRefusal = '';
    let refusedCount = 0;
    for (const action of [...actions].reverse()) {
      const refusal =
        action.kind === 'check'
          ? await this.store.uncheckBudgetLine(action.id)
          : await this.store.deleteTransaction(action.id);
      if (!refusal) continue;
      refusedCount += 1;
      if (!firstRefusal) firstRefusal = refusal;
    }
    if (refusedCount === 0) return;
    this.#notify(
      refusedCount === 1
        ? firstRefusal
        : this.#transloco.translate('currentMonth.undoPartialFailure', {
            count: refusedCount,
          }),
    );
  }

  // Material holds one snackbar, so this message destroys any undo still on
  // screen — and the window has to go with it. Left running, the list and the
  // timer kept offering a way back that no longer had a button: point one line,
  // have the server refuse the next, and the first was silently unreversible.
  // Settling rather than merely closing is what retires the glossaries, because
  // at that point the check really is a fact.
  #notify(message: string): void {
    this.#settleUndoWindow();
    this.#snackBar.open(
      message,
      this.#transloco.translate('currentMonth.close'),
      { duration: 5000 },
    );
  }

  protected async openAddTransaction(): Promise<void> {
    await this.#addTransactionDialog.open((transaction) =>
      this.#addTransaction(transaction),
    );
  }

  // The reason the write was refused, or null. Handed to the sheet, which
  // waits on it before closing: the amount, the label, the tags and the
  // savings source exist nowhere else, and the request used to leave after the
  // form holding them was destroyed. A refusal then cost the whole entry and
  // returned a toast — while the same fields get a confirmation dialog before
  // an accidental click outside is allowed to drop them.
  async #addTransaction(
    transaction: TransactionFormData,
  ): Promise<string | null> {
    const budgetId = this.store.dashboardData()?.budget?.id;
    // The sheet lives in the overlay and outlives a period rollover: returning
    // to the tab re-stamps the clock, the resource re-keys onto the new month,
    // and this reads null until it lands.
    if (!budgetId) {
      return this.#transloco.translate('currentMonth.addTransactionNoBudget');
    }
    const transactionCreate = transactionCreateFromQuickFormSchema.parse({
      ...transaction,
      budgetId,
      transactionDate: formatLocalDate(new Date()),
    });
    const outcome = await this.store.addTransaction(transactionCreate);
    if ('reason' in outcome) return outcome.reason;

    this.#confirmWithUndo({
      kind: 'transaction',
      id: outcome.transactionId,
      name: transactionCreate.name,
    });
    return null;
  }
}
