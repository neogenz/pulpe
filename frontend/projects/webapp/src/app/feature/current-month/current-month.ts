import { format } from 'date-fns';
import { frCH } from 'date-fns/locale';
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
import { StorageService, STORAGE_KEYS } from '@core/storage';

// Longer than the plain notification below: this toast is not read, it is
// reached. It has to survive the user noticing the mistake and travelling to
// the button.
export const UNDO_WINDOW_MS = 6000;

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
          class="text-headline-medium md:text-display-small truncate min-w-0 shrink pb-0"
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
            [realizedPercentage]="store.realizedPercentage()"
            [periodDates]="store.periodDates()"
            [rolloverAmount]="store.rolloverAmount()"
            [timeElapsedPercentage]="store.timeElapsedPercentage()"
            [paceStatus]="store.paceStatus()"
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
            (click)="openAddTransaction()"
            class="fab-button"
            [attr.aria-label]="'budgetLine.addTransaction' | transloco"
            data-testid="add-transaction-fab"
            data-tour="add-transaction-fab"
          >
            <mat-icon aria-hidden="true" class="fab-icon">add</mat-icon>
          </button>

          <!-- The month's open work. The list with a button on every row leads;
               the CSS order utilities used to put it second on desktop and
               first on mobile, which both buried the one actionable block
               behind a read-out and left the mobile reading order disagreeing
               with the tab order. -->
          <div
            class="grid grid-cols-1 lg:grid-cols-2 gap-6"
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
              <h2
                class="text-title-medium font-bold text-on-surface leading-tight"
              >
                {{ 'currentMonth.outlookTitle' | transloco }}
              </h2>
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
              @if (store.upcomingBudgetsData().length > 0) {
                <pulpe-dashboard-next-month
                  [forecast]="store.upcomingBudgetsData()[0]"
                  [estimatedRollover]="store.remaining()"
                  [hasError]="store.historyError() !== undefined"
                  [currency]="currency()"
                  (navigateToBudgets)="navigateToBudgetList()"
                  (retry)="store.refreshData()"
                  data-testid="dashboard-block-next-month"
                />
              }
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
      } @else if (store.status() === 'error') {
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
             failure now. -->
        <pulpe-dashboard-error
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
      padding: 0.25rem;
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

    .fab-button {
      position: fixed;
      bottom: calc(24px + env(safe-area-inset-bottom));
      right: 24px;
      z-index: 100;

      width: 56px;
      height: 56px;
      border-radius: 50%;

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

      &:hover .fab-icon {
        transform: rotate(90deg);
      }
    }

    .fab-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      transition: transform 300ms var(--pulpe-ease-emphasized);
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

      .fab-icon {
        transition: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Dashboard {
  protected readonly store = inject(DashboardStore);
  protected readonly currency = inject(UserSettingsStore).currency;
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
  // The ids one toast can still take back. A second check used to replace the
  // first toast and, with it, the only way back to the first line — pointing
  // three lines quickly left two of them stranded. They accumulate here for as
  // long as the window stays open, and the toast counts them.
  #undoableCheckIds: string[] = [];
  #undoWindowTimeout: ReturnType<typeof setTimeout> | null = null;

  protected readonly budgetPeriodDisplayName = computed(() => {
    const period = this.store.currentBudgetPeriod();
    return format(new Date(period.year, period.month - 1, 1), 'MMMM yyyy', {
      locale: frCH,
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
      const isLoading = this.store.isLoading();
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

  protected refresh(): void {
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

    this.#recordPointingLearned();
    this.#confirmCheckWithUndo(budgetLineId, name);
  }

  // The confirmation and the way back are one object. The toast's own live
  // region is what tells a screen reader the write landed — until now the
  // action was silent — and its button is the only reversal available here,
  // since a pointed line leaves the page and takes its own toggle with it.
  //
  // Which is why it accumulates. Clearing a month means pointing several lines
  // in a row, and each toast replaced the one before it: six seconds after the
  // first tap the first line was no longer recoverable, though the user was
  // still on the same run of taps. The window now restarts on every check and
  // covers all of them.
  #confirmCheckWithUndo(budgetLineId: string, name: string): void {
    this.#undoableCheckIds = [...this.#undoableCheckIds, budgetLineId];
    const ids = this.#undoableCheckIds;

    // The toast reports what the check actually moved, which is how many
    // forecasts are left to point — not the money. "Disponible" is
    // available − Σ max(line.amount, consumed): the envelope counts the plan
    // whether or not it has been pointed, so checking a line leaves that
    // figure exactly where it was. Printing it here gave five identical
    // numbers over five taps and read as a counter that had jammed.
    const left = this.store.uncheckedForecasts().length;

    const message =
      ids.length === 1
        ? this.#transloco.translate('currentMonth.uncheckedForecasts.checked', {
            name,
          })
        : this.#transloco.translate(
            'currentMonth.uncheckedForecasts.checkedMany',
            { count: ids.length },
          );
    const fullMessage =
      left > 0
        ? `${message} — ${this.#transloco.translate('currentMonth.uncheckedForecasts.stillToCheck', { count: left })}`
        : message;

    const ref = this.#snackBar.open(
      fullMessage,
      this.#transloco.translate('common.undo'),
      { duration: UNDO_WINDOW_MS, politeness: 'polite' },
    );
    ref.onAction().subscribe(() => {
      this.#closeUndoWindow();
      void this.#undoChecks(ids);
    });

    // The toast's own duration cannot own this: taking the undo, or another
    // check opening a new toast, both dismiss it without saying which happened.
    if (this.#undoWindowTimeout) clearTimeout(this.#undoWindowTimeout);
    this.#undoWindowTimeout = setTimeout(
      () => this.#closeUndoWindow(),
      UNDO_WINDOW_MS,
    );
  }

  #closeUndoWindow(): void {
    this.#undoableCheckIds = [];
    if (this.#undoWindowTimeout) {
      clearTimeout(this.#undoWindowTimeout);
      this.#undoWindowTimeout = null;
    }
  }

  // Sequential, not parallel: each uncheck recomputes the month server-side, and
  // the store patches one line at a time. Reversed so the month walks back the
  // way it came.
  async #undoChecks(budgetLineIds: readonly string[]): Promise<void> {
    for (const id of [...budgetLineIds].reverse()) {
      const refusal = await this.store.uncheckBudgetLine(id);
      if (refusal) {
        this.#notify(refusal);
        return;
      }
    }
  }

  #notify(message: string): void {
    this.#snackBar.open(
      message,
      this.#transloco.translate('currentMonth.close'),
      { duration: 5000 },
    );
  }

  protected async openAddTransaction(): Promise<void> {
    const transaction = await this.#addTransactionDialog.open();
    if (transaction) {
      await this.#addTransaction(transaction);
    }
  }

  async #addTransaction(transaction: TransactionFormData): Promise<void> {
    const budgetId = this.store.dashboardData()?.budget?.id;
    if (!budgetId) {
      return;
    }
    const transactionCreate = transactionCreateFromQuickFormSchema.parse({
      ...transaction,
      budgetId,
      transactionDate: formatLocalDate(new Date()),
    });
    const outcome = await this.store.addTransaction(transactionCreate);
    if ('reason' in outcome) {
      this.#notify(outcome.reason);
      return;
    }
    this.#confirmTransactionWithUndo(
      outcome.transactionId,
      transactionCreate.name,
    );
  }

  // Recording a transaction is what this page is for, and it was the one action
  // here with no way back: a mistyped amount had to be hunted down in another
  // page to be removed, while checking a box — one method above — has always
  // offered six seconds and an undo. The sheet closes over the write and on a
  // phone the figures it moved are a screenful up, so the toast is also the
  // only evidence the money was written down at all.
  #confirmTransactionWithUndo(transactionId: string, name: string): void {
    const ref = this.#snackBar.open(
      this.#transloco.translate('currentMonth.transactionAdded', { name }),
      this.#transloco.translate('common.undo'),
      { duration: UNDO_WINDOW_MS, politeness: 'polite' },
    );
    ref.onAction().subscribe(() => void this.#undoTransaction(transactionId));
  }

  async #undoTransaction(transactionId: string): Promise<void> {
    const refusal = await this.store.deleteTransaction(transactionId);
    if (refusal) this.#notify(refusal);
  }
}
