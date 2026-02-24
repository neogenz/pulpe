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
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  MatBottomSheet,
  MatBottomSheetModule,
} from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LoadingIndicator } from '@core/loading/loading-indicator';
import { Logger } from '@core/logging/logger';
import {
  ProductTourService,
  TOUR_START_DELAY,
} from '@core/product-tour/product-tour.service';
import { type TransactionCreate, getBudgetPeriodDates } from 'pulpe-shared';
import { BaseLoading } from '@ui/loading';
import { StateCard } from '@ui/state-card/state-card';
import { AddTransactionBottomSheet } from './components/add-transaction-bottom-sheet';
import { DashboardError } from './components/dashboard-error';
import { DashboardStore } from './services/dashboard-store';

// New Blocks
import { DashboardHero } from './components/dashboard-hero';
import { DashboardUncheckedForecasts } from './components/dashboard-unchecked-forecasts';
import { DashboardHistoryChart } from './components/dashboard-history-chart';
import { DashboardUpcomingMonths } from './components/dashboard-upcoming-months';
import { DashboardFutureProjectionChart } from './components/dashboard-future-projection-chart';

type TransactionFormData = Pick<
  TransactionCreate,
  'name' | 'amount' | 'kind' | 'category'
>;

@Component({
  selector: 'pulpe-dashboard',
  standalone: true,
  imports: [
    MatButtonModule,
    MatBottomSheetModule,
    MatIconModule,
    MatTooltipModule,
    DashboardError,
    BaseLoading,
    StateCard,
    DashboardHero,
    DashboardUncheckedForecasts,
    DashboardHistoryChart,
    DashboardUpcomingMonths,
    DashboardFutureProjectionChart,
  ],
  template: `
    <div class="flex flex-col gap-4 min-w-0" data-testid="dashboard-page">
      <header class="pulpe-page-header" data-testid="page-header">
        <h1
          class="text-headline-medium md:text-display-small truncate min-w-0 flex-shrink"
          data-testid="page-title"
        >
          Tableau de bord
        </h1>
        <div class="flex gap-2 items-center flex-shrink-0 ml-auto">
          <button
            matIconButton
            (click)="store.refreshData()"
            [disabled]="store.isLoading()"
            matTooltip="Actualiser"
            aria-label="Actualiser"
            data-testid="refresh-button"
          >
            <mat-icon>refresh</mat-icon>
          </button>
        </div>
      </header>

      @switch (true) {
        @case (store.isInitialLoading()) {
          <pulpe-base-loading
            message="Préparation de ton tableau de bord..."
            size="large"
            testId="dashboard-loading"
          />
        }
        @case (store.status() === 'error') {
          <pulpe-dashboard-error
            (reload)="store.refreshData()"
            data-testid="dashboard-error"
          />
        }
        @case (
          store.status() === 'resolved' ||
          store.status() === 'local' ||
          store.status() === 'reloading'
        ) {
          @if (store.dashboardData()?.budget) {
            <div class="flex flex-col gap-8">
              <!-- BLOCK 1: Hero figure "Disponible à dépenser" -->
              <pulpe-dashboard-hero
                [expenses]="store.totalExpenses()"
                [available]="store.totalAvailable()"
                [periodDates]="periodDates()"
                data-testid="dashboard-block-hero"
              />

              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Row 1 -->
                <pulpe-dashboard-unchecked-forecasts
                  [forecasts]="store.uncheckedForecasts()"
                  (toggleCheck)="store.toggleBudgetLineCheck($event)"
                  data-testid="dashboard-block-forecasts"
                />

                <pulpe-dashboard-history-chart
                  [history]="store.historyData()"
                  data-testid="dashboard-block-history"
                />

                <!-- Row 2 -->
                <pulpe-dashboard-upcoming-months
                  [forecasts]="store.upcomingBudgetsData()"
                  data-testid="dashboard-block-upcoming"
                />

                <pulpe-dashboard-future-projection-chart
                  [forecasts]="store.upcomingBudgetsData()"
                  data-testid="dashboard-block-projection"
                />
              </div>
            </div>
          } @else {
            <pulpe-state-card
              variant="empty"
              testId="empty-state"
              [title]="'Pas encore de budget pour ' + budgetPeriodDisplayName()"
              message="Crée-le depuis tes modèles pour commencer à suivre ton mois."
            />
          }
        }
      }
    </div>

    <!-- FAB pour ajouter une transaction -->
    <button
      matFab
      [disabled]="!store.dashboardData()?.budget"
      (click)="openAddTransactionBottomSheet()"
      class="fab-button"
      aria-label="Ajouter une transaction"
      data-testid="add-transaction-fab"
      data-tour="add-transaction-fab"
    >
      <mat-icon class="fab-icon">add</mat-icon>
    </button>
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      padding-bottom: 100px;
      /* Optional M3 Expressive adjustments */
    }

    .fab-button {
      position: fixed;
      bottom: calc(24px + env(safe-area-inset-bottom));
      right: 24px;
      z-index: 1000;

      /* M3: standard round FAB */
      width: 56px;
      height: 56px;
      border-radius: 50%;

      /* M3 Expressive: gradient matching the hero card */
      --mdc-fab-container-color: var(--mat-sys-primary);
      --mat-fab-container-color: var(--mat-sys-primary);
      --mat-fab-disabled-state-container-color: var(--mat-sys-primary);
      --mat-fab-disabled-state-foreground-color: var(--mat-sys-on-primary);
      --mdc-fab-icon-color: var(--mat-sys-on-primary);
      background: linear-gradient(
        145deg,
        var(--mat-sys-primary) 0%,
        color-mix(in srgb, var(--mat-sys-primary) 75%, black) 100%
      );
      color: var(--mat-sys-on-primary);

      &:disabled {
        opacity: 0.5;
      }

      /* Premium multi-layer shadow */
      box-shadow:
        0 2px 4px -1px rgba(0, 0, 0, 0.1),
        0 4px 8px rgba(0, 0, 0, 0.08),
        0 8px 16px rgba(0, 0, 0, 0.06);

      /* Smooth transitions for hover/press */
      transition:
        transform 200ms var(--pulpe-ease-emphasized),
        box-shadow 200ms var(--pulpe-ease-emphasized);

      /* Entrance animation with overshoot bounce */
      animation: fab-scale-in var(--pulpe-motion-base)
        var(--pulpe-ease-emphasized) both;

      &:hover:not(:disabled) {
        transform: scale(1.05);
        box-shadow:
          0 4px 8px -2px rgba(0, 0, 0, 0.12),
          0 8px 16px rgba(0, 0, 0, 0.1),
          0 12px 24px rgba(0, 0, 0, 0.08);
      }

      &:active:not(:disabled) {
        transform: scale(0.95);
        box-shadow:
          0 1px 2px rgba(0, 0, 0, 0.1),
          0 2px 4px rgba(0, 0, 0, 0.08);
        transition-duration: 100ms;
      }

      &:hover:not(:disabled) .fab-icon {
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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Dashboard {
  readonly isCreatingTransaction = signal(false);
  protected readonly store = inject(DashboardStore);
  readonly #productTourService = inject(ProductTourService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #loadingIndicator = inject(LoadingIndicator);
  readonly #bottomSheet = inject(MatBottomSheet);
  readonly #logger = inject(Logger);

  protected readonly budgetPeriodDisplayName = computed(() => {
    const period = this.store.currentBudgetPeriod();
    return format(new Date(period.year, period.month - 1, 1), 'MMMM yyyy', {
      locale: frCH,
    });
  });

  protected readonly periodDates = computed(() => {
    const period = this.store.currentBudgetPeriod();
    const payDay = this.store.payDayOfMonth();
    return getBudgetPeriodDates(period.month, period.year, payDay);
  });

  constructor() {
    this.store.refreshData();

    effect(() => {
      const status = this.store.status();
      this.#loadingIndicator.setLoading(status === 'reloading');
    });

    this.#destroyRef.onDestroy(() => {
      this.#loadingIndicator.setLoading(false);
    });

    afterNextRender(() => {
      if (!this.#productTourService.hasSeenPageTour('current-month')) {
        setTimeout(
          () => this.#productTourService.startPageTour('current-month'),
          TOUR_START_DELAY,
        );
      }
    });
  }

  openAddTransactionBottomSheet(): void {
    const bottomSheetRef = this.#bottomSheet.open(AddTransactionBottomSheet, {
      disableClose: false,
      panelClass: 'add-transaction-bottom-sheet',
    });

    bottomSheetRef
      .afterDismissed()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((transaction: TransactionFormData | undefined) => {
        if (transaction) {
          this.onAddTransaction(transaction);
        }
      });
  }

  async onAddTransaction(transaction: TransactionFormData) {
    try {
      this.isCreatingTransaction.set(true);
      const budgetId = this.store.dashboardData()?.budget?.id;
      if (!budgetId) {
        throw new Error('Budget ID not found');
      }
      await this.store.addTransaction({
        budgetId,
        amount: transaction.amount ?? 0,
        name: transaction.name,
        kind: transaction.kind,
        transactionDate: new Date().toISOString(),
        category: transaction.category ?? null,
      });
    } catch (error) {
      this.#logger.error('Error adding transaction:', error);
    } finally {
      this.isCreatingTransaction.set(false);
    }
  }
}
