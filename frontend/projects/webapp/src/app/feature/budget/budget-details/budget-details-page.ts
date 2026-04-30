import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  computed,
  effect,
  isDevMode,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { DatePipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { LoadingIndicator } from '@core/loading/loading-indicator';
import { BreadcrumbState } from '@core/routing';
import {
  ProductTourService,
  TOUR_START_DELAY,
} from '@core/product-tour/product-tour.service';
import { formatDate } from 'date-fns';
import { frCH } from 'date-fns/locale';
import { BaseLoading } from '@ui/loading';
import { BudgetFinancialOverview } from '@ui/budget-financial-overview/budget-financial-overview';
import { BudgetDetailsStore } from './store/budget-details-store';
import { BudgetItemsContainer } from './budget-items-container';
import { BudgetDetailsDialogService } from './budget-details-dialog.service';
import { formatBudgetPeriod } from 'pulpe-shared';
import { UserSettingsStore } from '@core/user-settings';
import { CURRENCY_CONFIG } from '@core/currency';

@Component({
  selector: 'pulpe-budget-details-page',
  imports: [
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    DatePipe,
    TranslocoPipe,
    BudgetItemsContainer,
    BudgetFinancialOverview,
    BaseLoading,
  ],
  providers: [BudgetDetailsStore, BudgetDetailsDialogService],
  template: `
    <div class="flex flex-col gap-8 min-w-0" data-testid="budget-detail-page">
      @if (store.isInitialLoading()) {
        <pulpe-base-loading
          [message]="'budget.loading' | transloco"
          size="large"
          [fullHeight]="true"
          testId="budget-details-loading"
        ></pulpe-base-loading>
      } @else if (store.error()) {
        <mat-card class="bg-error-container/50 border-0" appearance="outlined">
          <mat-card-content>
            <div class="flex items-center gap-3 text-on-error-container py-2">
              <mat-icon>error_outline</mat-icon>
              <span class="text-body-large">{{
                'budget.loadError' | transloco
              }}</span>
            </div>
          </mat-card-content>
        </mat-card>
      } @else if (store.budgetDetails()) {
        @let budget = store.budgetDetails()!;
        <!-- Header: Month navigation with chevrons -->
        <header class="relative">
          <div class="flex items-center justify-center gap-2 min-w-0">
            <!-- Mobile: icon button only -->
            <button
              matIconButton
              [disabled]="!store.hasPrevious()"
              (click)="navigateToPrevious()"
              [attr.aria-label]="'layout.previousMonth' | transloco"
              data-testid="previous-month-button"
              class="shrink-0 lg:hidden!"
            >
              <mat-icon>chevron_left</mat-icon>
            </button>
            <!-- Desktop: text button -->
            <button
              matButton
              [disabled]="!store.hasPrevious()"
              (click)="navigateToPrevious()"
              [attr.aria-label]="'layout.previousMonth' | transloco"
              data-testid="previous-month-button-desktop"
              class="hidden! lg:flex! shrink-0"
            >
              <mat-icon>chevron_left</mat-icon>
              <span>{{ 'layout.previousMonth' | transloco }}</span>
            </button>
            <div class="flex-1 min-w-0 text-center">
              <h1
                class="text-display-small sm:text-display-medium truncate capitalize"
              >
                {{ displayName() }}
              </h1>
              @if (periodDisplay()) {
                <p
                  class="text-body-large text-on-surface-variant"
                  data-testid="budget-period-display"
                >
                  {{ periodDisplay() }}
                </p>
              }
              @if (budget.description) {
                <p class="text-body-medium text-on-surface-variant mt-1">
                  {{ budget.description }}
                </p>
              }
            </div>
            <!-- Mobile: icon button only -->
            <button
              matIconButton
              [disabled]="!store.hasNext()"
              (click)="navigateToNext()"
              [attr.aria-label]="'layout.nextMonth' | transloco"
              data-testid="next-month-button"
              class="shrink-0 lg:hidden!"
            >
              <mat-icon>chevron_right</mat-icon>
            </button>
            <!-- Desktop: text button -->
            <button
              matButton
              [disabled]="!store.hasNext()"
              (click)="navigateToNext()"
              [attr.aria-label]="'layout.nextMonth' | transloco"
              data-testid="next-month-button-desktop"
              class="hidden! lg:flex! shrink-0"
            >
              <span>{{ 'layout.nextMonth' | transloco }}</span>
              <mat-icon iconPositionEnd>chevron_right</mat-icon>
            </button>
          </div>
        </header>

        <!-- Financial Overview -->
        <pulpe-budget-financial-overview
          [totals]="financialTotals()"
          [currency]="currency()"
          [locale]="currencyLocale()"
          data-tour="financial-overview"
        />

        <!-- Budget Items -->
        <pulpe-budget-items data-tour="budget-table" />

        <button
          matFab
          (click)="openAddBudgetLineDialog()"
          class="fab-button"
          [attr.aria-label]="'budget.addForecast' | transloco"
          data-testid="add-budget-line-fab"
        >
          <mat-icon aria-hidden="true" class="fab-icon">add</mat-icon>
        </button>

        @if (isDevMode) {
          <!-- Budget Info Card -->
          <mat-card appearance="outlined">
            <mat-card-header>
              <div mat-card-avatar>
                <div
                  class="flex justify-center items-center size-11 bg-primary-container rounded-full"
                >
                  <mat-icon class="text-on-primary-container"
                    >calendar_month</mat-icon
                  >
                </div>
              </div>
              <mat-card-title>{{
                'budget.periodInfo' | transloco
              }}</mat-card-title>
              <mat-card-subtitle>{{
                'budget.periodDetails' | transloco
              }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <div class="text-label-medium text-on-surface-variant">
                    {{ 'budget.period' | transloco }}
                  </div>
                  <p class="text-body-large">{{ displayName() }}</p>
                </div>
                <div>
                  <div class="text-label-medium text-on-surface-variant">
                    {{ 'budget.createdAt' | transloco }}
                  </div>
                  <p class="text-body-large">
                    {{ budget.createdAt | date: 'short' }}
                  </p>
                </div>
                <div>
                  <div class="text-label-medium text-on-surface-variant">
                    {{ 'budget.lastModified' | transloco }}
                  </div>
                  <p class="text-body-large">
                    {{ budget.updatedAt | date: 'short' }}
                  </p>
                </div>
                <div>
                  <div class="text-label-medium text-on-surface-variant">
                    {{ 'budget.budgetId' | transloco }}
                  </div>
                  <p class="text-body-small font-mono text-on-surface-variant">
                    {{ budget.id }}
                  </p>
                </div>
              </div>
            </mat-card-content>
          </mat-card>
        }
      } @else {
        <div class="flex justify-center items-center h-full">
          <p class="text-body-large">{{ 'budget.notFound' | transloco }}</p>
        </div>
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
      --mat-fab-container-shape: 50%;

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
        box-shadow: var(--mat-sys-level3);
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
export default class BudgetDetailsPage {
  protected readonly isDevMode = isDevMode();
  protected readonly store = inject(BudgetDetailsStore);
  readonly #router = inject(Router);
  readonly #breadcrumbState = inject(BreadcrumbState);
  readonly #productTourService = inject(ProductTourService);
  readonly #userSettingsStore = inject(UserSettingsStore);
  readonly #loadingIndicator = inject(LoadingIndicator);
  readonly #destroyRef = inject(DestroyRef);
  readonly #dialogService = inject(BudgetDetailsDialogService);

  protected readonly currency = this.#userSettingsStore.currency;
  protected readonly currencyLocale = computed(
    () => CURRENCY_CONFIG[this.currency()].numberLocale,
  );
  protected readonly financialTotals = this.store.financialTotals;

  readonly id = input.required<string>();

  readonly displayName = computed(() => {
    const budget = this.store.budgetDetails();
    if (!budget) return '';
    const date = new Date(budget.year, budget.month - 1, 1);
    return formatDate(date, 'MMMM yyyy', { locale: frCH });
  });

  readonly periodDisplay = computed(() => {
    const budget = this.store.budgetDetails();
    const payDayOfMonth = this.#userSettingsStore.payDayOfMonth();
    if (!budget || !payDayOfMonth || payDayOfMonth === 1) return null;
    return formatBudgetPeriod(budget.month, budget.year, payDayOfMonth);
  });

  constructor() {
    effect(() => {
      this.store.setBudgetId(this.id());
    });

    effect(() => {
      const isStale = this.store.isStale();
      this.#loadingIndicator.setLoading(isStale);
    });

    this.#destroyRef.onDestroy(() => {
      this.#loadingIndicator.setLoading(false);
    });

    effect((onCleanup) => {
      const details = this.store.budgetDetails();
      if (details) {
        const label = formatDate(
          new Date(details.year, details.month - 1, 1),
          'MMMM yyyy',
          { locale: frCH },
        );
        this.#breadcrumbState.setDynamicBreadcrumb(label);

        onCleanup(() => {
          this.#breadcrumbState.clearDynamicBreadcrumb();
        });
      }
    });

    afterNextRender(() => {
      if (!this.#productTourService.hasSeenPageTour('budget-details')) {
        setTimeout(
          () => this.#productTourService.startPageTour('budget-details'),
          TOUR_START_DELAY,
        );
      }
    });
  }

  navigateToPrevious(): void {
    const id = this.store.previousBudgetId();
    if (id) {
      this.#router.navigate(['/', 'budget', id]);
    }
  }

  navigateToNext(): void {
    const id = this.store.nextBudgetId();
    if (id) {
      this.#router.navigate(['/', 'budget', id]);
    }
  }

  protected async openAddBudgetLineDialog(): Promise<void> {
    const budget = this.store.budgetDetails();
    if (!budget) return;

    const budgetLine = await this.#dialogService.openAddBudgetLineDialog(
      budget.id,
    );
    if (budgetLine) {
      await this.store.createBudgetLine(budgetLine);
    }
  }
}
