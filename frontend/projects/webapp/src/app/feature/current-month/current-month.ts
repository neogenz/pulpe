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
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  MatBottomSheet,
  MatBottomSheetModule,
} from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { formatLocalDate } from '@core/date/format-local-date';
import { LoadingIndicator } from '@core/loading/loading-indicator';
import { Logger } from '@core/logging/logger';
import { ROUTES } from '@core/routing/routes-constants';
import {
  ProductTourService,
  TOUR_START_DELAY,
} from '@core/product-tour/product-tour.service';
import { type TransactionCreate } from 'pulpe-shared';
import { BaseLoading } from '@ui/loading';
import { StateCard } from '@ui/state-card/state-card';
import { AddTransactionBottomSheet } from './components/add-transaction-bottom-sheet';
import { DashboardError } from './components/dashboard-error';
import { DashboardStore } from './services/dashboard-store';

import { DashboardHero } from '@ui/dashboard-hero/dashboard-hero';
import { DashboardUncheckedForecasts } from './components/dashboard-unchecked-forecasts';
import { DashboardHistoryChart } from './components/dashboard-history-chart';
import { DashboardFutureProjectionChart } from './components/dashboard-future-projection-chart';
import { DashboardRecentTransactions } from './components/dashboard-recent-transactions';
import { DashboardSavingsSummary } from './components/dashboard-savings-summary';
import { DashboardNextMonth } from './components/dashboard-next-month';

type TransactionFormData = Pick<
  TransactionCreate,
  'name' | 'amount' | 'kind' | 'category' | 'checkedAt'
>;

@Component({
  selector: 'pulpe-dashboard',
  imports: [
    MatButtonModule,
    MatBottomSheetModule,
    MatIconModule,
    MatSnackBarModule,
    MatTooltipModule,
    DashboardError,
    BaseLoading,
    StateCard,
    TranslocoPipe,
    DashboardHero,
    DashboardUncheckedForecasts,
    DashboardHistoryChart,
    DashboardFutureProjectionChart,
    DashboardRecentTransactions,
    DashboardSavingsSummary,
    DashboardNextMonth,
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
          <button
            matIconButton
            (click)="store.refreshData()"
            [disabled]="store.isLoading()"
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
      } @else if (store.status() === 'error') {
        <pulpe-dashboard-error
          (reload)="store.refreshData()"
          data-testid="dashboard-error"
        />
      } @else if (store.dashboardData()?.budget) {
        <div class="flex flex-col gap-8">
          <!-- Hero "Disponible à dépenser" -->
          <pulpe-dashboard-hero
            [expenses]="store.totalExpenses()"
            [available]="store.totalAvailable()"
            [remaining]="store.remaining()"
            [budgetConsumedPercentage]="store.budgetConsumedPercentage()"
            [periodDates]="store.periodDates()"
            [totalIncome]="store.totalIncome()"
            [rolloverAmount]="store.rolloverAmount()"
            [timeElapsedPercentage]="store.timeElapsedPercentage()"
            [paceStatus]="store.paceStatus()"
            (heroClick)="navigateToBudgetDetails()"
            data-testid="dashboard-block-hero"
            data-tour="dashboard-hero"
          />

          <!-- Paired lists: Recent Transactions + Unchecked Forecasts -->
          <div
            class="grid grid-cols-1 lg:grid-cols-2 gap-8"
            data-tour="dashboard-lists"
          >
            <pulpe-dashboard-recent-transactions
              class="order-2 lg:order-1"
              [transactions]="store.recentTransactions()"
              (viewBudget)="navigateToBudgetDetails()"
              data-testid="dashboard-block-recent-transactions"
            />

            <pulpe-dashboard-unchecked-forecasts
              class="order-1 lg:order-2"
              [forecasts]="store.uncheckedForecasts()"
              [consumptions]="store.consumptions()"
              (toggleCheck)="toggleBudgetLineCheck($event)"
              (viewBudget)="navigateToBudgetDetails()"
              data-testid="dashboard-block-forecasts"
            />
          </div>

          <!-- Future Projection Chart -->
          <pulpe-dashboard-future-projection-chart
            [forecasts]="store.upcomingBudgetsData()"
            data-testid="dashboard-block-projection"
          />

          <!-- Paired metrics: Savings Summary + Next Month -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <pulpe-dashboard-savings-summary
              [totalPlanned]="store.totalSavingsPlanned()"
              [totalRealized]="store.totalSavingsRealized()"
              [checkedCount]="store.savingsCheckedCount()"
              [totalCount]="store.savingsTotalCount()"
              data-testid="dashboard-block-savings"
            />

            @if (store.upcomingBudgetsData().length > 0) {
              <pulpe-dashboard-next-month
                [forecast]="store.upcomingBudgetsData()[0]"
                [estimatedRollover]="store.remaining()"
                (navigateToBudgets)="navigateToBudgetList()"
                data-testid="dashboard-block-next-month"
              />
            }
          </div>

          <!-- History Chart -->
          <pulpe-dashboard-history-chart
            [history]="store.historyData()"
            data-testid="dashboard-block-history"
          />
        </div>

        <!-- FAB: only visible when budget data is loaded -->
        <button
          matFab
          (click)="openAddTransactionBottomSheet()"
          class="fab-button"
          [attr.aria-label]="'budgetLine.addTransaction' | transloco"
          data-testid="add-transaction-fab"
          data-tour="add-transaction-fab"
        >
          <mat-icon aria-hidden="true" class="fab-icon">add</mat-icon>
        </button>
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

    .fab-button {
      position: fixed;
      bottom: calc(24px + env(safe-area-inset-bottom));
      right: 24px;
      z-index: 100;

      width: 56px;
      height: 56px;
      border-radius: 50%;

      --mat-fab-container-color: var(--mat-sys-primary);
      background: linear-gradient(
        145deg,
        var(--mat-sys-primary) 0%,
        color-mix(in srgb, var(--mat-sys-primary) 75%, black) 100%
      );
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
  readonly #productTourService = inject(ProductTourService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #loadingIndicator = inject(LoadingIndicator);
  readonly #bottomSheet = inject(MatBottomSheet);
  readonly #router = inject(Router);
  readonly #logger = inject(Logger);
  readonly #snackBar = inject(MatSnackBar);
  readonly #transloco = inject(TranslocoService);

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

    this.#destroyRef.onDestroy(() => {
      this.#loadingIndicator.setLoading(false);
    });

    afterNextRender(() => {
      if (!this.#productTourService.hasSeenPageTour('dashboard')) {
        setTimeout(
          () => this.#productTourService.startPageTour('dashboard'),
          TOUR_START_DELAY,
        );
      }
    });
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

  protected async toggleBudgetLineCheck(budgetLineId: string): Promise<void> {
    try {
      await this.store.toggleBudgetLineCheck(budgetLineId);
    } catch (error) {
      this.#logger.error('Error toggling budget line check:', error);
      this.#snackBar.open(
        this.#transloco.translate('currentMonth.updateError'),
        this.#transloco.translate('currentMonth.close'),
        { duration: 5000 },
      );
    }
  }

  protected openAddTransactionBottomSheet(): void {
    const bottomSheetRef = this.#bottomSheet.open(AddTransactionBottomSheet, {
      disableClose: false,
      panelClass: 'add-transaction-bottom-sheet',
    });

    bottomSheetRef
      .afterDismissed()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((transaction: TransactionFormData | undefined) => {
        if (transaction) {
          this.#addTransaction(transaction);
        }
      });
  }

  async #addTransaction(transaction: TransactionFormData): Promise<void> {
    try {
      const budgetId = this.store.dashboardData()?.budget?.id;
      if (!budgetId) {
        throw new Error('Budget ID not found');
      }
      await this.store.addTransaction({
        budgetId,
        amount: transaction.amount ?? 0,
        name: transaction.name,
        kind: transaction.kind,
        transactionDate: formatLocalDate(new Date()),
        category: transaction.category ?? null,
        checkedAt: transaction.checkedAt ?? null,
      });
    } catch (error) {
      this.#logger.error('Error adding transaction:', error);
      this.#snackBar.open(
        this.#transloco.translate('currentMonth.addError'),
        this.#transloco.translate('currentMonth.close'),
        { duration: 5000 },
      );
    }
  }
}
