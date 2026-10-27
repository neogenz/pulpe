import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  computed,
  effect,
  isDevMode,
} from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatDialog } from '@angular/material/dialog';
import { formatLocalDate } from '@core/date/format-local-date';
import { openReconcileAccountsDialog } from '@pattern/reconcile-accounts/reconcile-accounts-dialog';
import { Router } from '@angular/router';
import { v4 as uuidv4 } from 'uuid';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DatePipe } from '@angular/common';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LoadingIndicator } from '@core/loading/loading-indicator';
import { BreadcrumbState } from '@core/shell/breadcrumb-state';
import { ROUTES } from '@core/routing/routes-constants';
import { formatDate } from 'date-fns';
import { dateFnsLocaleFor } from '@core/locale';
import { BaseLoading } from '@ui/loading';
import { BudgetFinancialOverview } from '@ui/budget-financial-overview/budget-financial-overview';
import { BudgetDetailsStore } from './store/budget-details-store';
import { BudgetItemsContainer } from './components/budget-items-container';
import { BudgetDetailsDialogService } from './budget-details-dialog.service';
import { TransactionImportApi } from './transaction-import/transaction-import-api';
import {
  openMutationErrorSnackbar,
  spreadCreateEcho,
  submitSavingsWithdrawalWithRetry,
  submitSpreadWithRetry,
} from './utils/budget-details-snackbar.utils';
import {
  type BudgetDeletionImpact,
  formatBudgetPeriod,
  getBudgetPeriodDates,
  transactionCreateSchema,
  type SupportedCurrency,
} from 'pulpe-shared';
import { UserSettingsStore } from '@core/user-settings';
import { CURRENCY_CONFIG } from '@core/currency';

@Component({
  selector: 'pulpe-budget-details-page',
  imports: [
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    DatePipe,
    TranslocoPipe,
    BudgetItemsContainer,
    BudgetFinancialOverview,
    BaseLoading,
  ],
  providers: [
    BudgetDetailsStore,
    BudgetDetailsDialogService,
    TransactionImportApi,
  ],
  templateUrl: './budget-details-page.html',
  styles: `
    :host {
      display: block;
      position: relative;
      padding-bottom: 100px;
    }

    /* Material tient la géométrie de la variante étendue (hauteur 56,
       corner-large), il n'y a donc rien à figer ici. Aplati comme sur la page
       d'accueil : DESIGN.md réserve le dégradé au hero. */
    .fab-button {
      position: fixed;
      bottom: calc(24px + env(safe-area-inset-bottom));
      right: 24px;
      z-index: 100;

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
export default class BudgetDetailsPage {
  protected readonly isDevMode = isDevMode();
  protected readonly store = inject(BudgetDetailsStore);
  protected readonly userSettingsStore = inject(UserSettingsStore);
  readonly #router = inject(Router);
  readonly #breadcrumbState = inject(BreadcrumbState);
  readonly #loadingIndicator = inject(LoadingIndicator);
  readonly #destroyRef = inject(DestroyRef);
  readonly #dialogService = inject(BudgetDetailsDialogService);
  readonly #snackBar = inject(MatSnackBar);
  readonly #transloco = inject(TranslocoService);
  readonly #dialog = inject(MatDialog);
  readonly #breakpoints = inject(BreakpointObserver);
  #isDeletingMonth = false;

  protected readonly currencyLocale = computed(
    () => CURRENCY_CONFIG[this.userSettingsStore.currency()].numberLocale,
  );
  protected readonly dateLocale = computed(
    () => CURRENCY_CONFIG[this.userSettingsStore.currency()].locale,
  );
  protected readonly dateFnsLocale = computed(() =>
    dateFnsLocaleFor(
      this.userSettingsStore.locale(),
      this.userSettingsStore.currency(),
    ),
  );
  protected readonly financialTotals = this.store.financialTotals;

  readonly id = input.required<string>();

  protected readonly displayName = computed(() => {
    const budget = this.store.budgetDetails();
    if (!budget) return '';
    const date = new Date(budget.year, budget.month - 1, 1);
    return formatDate(date, 'MMMM yyyy', { locale: this.dateFnsLocale() });
  });

  protected readonly periodDisplay = computed(() => {
    const budget = this.store.budgetDetails();
    const payDayOfMonth = this.userSettingsStore.payDayOfMonth();
    if (!budget || !payDayOfMonth || payDayOfMonth === 1) return null;
    return formatBudgetPeriod(
      budget.month,
      budget.year,
      payDayOfMonth,
      this.userSettingsStore.locale(),
    );
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
          { locale: this.dateFnsLocale() },
        );
        this.#breadcrumbState.setDynamicBreadcrumb(label);

        onCleanup(() => {
          this.#breadcrumbState.clearDynamicBreadcrumb();
        });
      }
    });
  }

  protected openReconcileAccounts(): void {
    const budget = this.store.budgetDetails();
    if (!budget || budget.id !== this.id()) return;
    const adjustmentId = uuidv4();
    const matches = () =>
      !this.#destroyRef.destroyed &&
      this.id() === budget.id &&
      this.store.budgetDetails()?.id === budget.id;
    openReconcileAccountsDialog(
      this.#dialog,
      {
        realized: computed(() =>
          matches()
            ? {
                balance:
                  this.store.realizedBalance() +
                  this.store.previousMonthRollover(),
                checkedIncome: this.store.realizedIncome(),
                checkedOutflows: this.store.realizedExpenses(),
                rollover: this.store.previousMonthRollover(),
              }
            : null,
        ),
        currency: this.userSettingsStore.currency,
        periodDates: computed(() =>
          getBudgetPeriodDates(
            budget.month,
            budget.year,
            this.userSettingsStore.payDayOfMonth(),
          ),
        ),
        recordAdjustment: async (adjustment) => {
          if (!matches()) return false;
          const now = new Date();
          const error = await this.store.createAllocatedTransaction(
            transactionCreateSchema.parse({
              ...adjustment,
              id: adjustmentId,
              budgetId: budget.id,
              transactionDate: formatLocalDate(now),
              checkedAt: now.toISOString(),
            }),
          );
          this.#snackBar.open(
            error ?? this.#transloco.translate('budget.transactionAdded'),
            this.#transloco.translate('common.close'),
            { duration: 5000, verticalPosition: 'top' },
          );
          return error === null;
        },
        viewItemsToCheck: () => undefined,
      },
      this.#breakpoints.isMatched(Breakpoints.Handset),
    );
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

  // Two hops (read the impact, then delete) leave room for a second tap on the
  // menu item: one run at a time.
  protected async deleteMonth(): Promise<void> {
    if (this.#isDeletingMonth) return;
    this.#isDeletingMonth = true;
    // Navigating to another month while the impact loads or the dialog is open
    // re-points the store: the month confirmed is the one captured here.
    const id = this.id();
    try {
      const impact = await this.store.deletionImpact(id);
      if (this.id() !== id) return;
      if (!impact) {
        this.#notifyMonthDeleteError();
        return;
      }
      const hasLinks = Object.values(impact.links).some((count) => count > 0);
      const confirmed = await this.#dialogService.confirmDelete({
        title: this.#transloco.translate('budget.deleteMonthTitle', {
          month: this.displayName(),
        }),
        message: this.#deleteMonthMessage(impact),
      });
      if (!confirmed || this.id() !== id) return;

      const isDeleted = await this.store.deleteMonth(id, hasLinks, () =>
        this.#router.navigate(['/', ROUTES.BUDGET]),
      );
      if (!isDeleted) {
        this.#notifyMonthDeleteError();
        return;
      }
      this.#snackBar.open(
        this.#transloco.translate('budget.monthDeleted'),
        this.#transloco.translate('common.close'),
        { duration: 3000 },
      );
    } finally {
      this.#isDeletingMonth = false;
    }
  }

  #deleteMonthMessage(impact: BudgetDeletionImpact): string {
    const counts = this.#transloco.translate('budget.deleteMonthMessage', {
      forecastCount: impact.forecastCount,
      movementCount: impact.movementCount,
    });
    const { links } = impact;
    const linkLabels: [key: string, count: number][] = [
      ['budget.deleteMonthLinkSpread', links.spreadForecasts],
      ['budget.deleteMonthLinkGoal', links.savingsGoalForecasts],
      [
        'budget.deleteMonthLinkWithdrawal',
        links.savingsWithdrawalForecasts + links.savingsWithdrawalMovements,
      ],
    ];
    const linked = linkLabels
      .filter(([, count]) => count > 0)
      .map(([key, count]) => this.#transloco.translate(key, { count }))
      .join(', ');
    if (!linked) return counts;
    return `${counts} ${this.#transloco.translate('budget.deleteMonthLinks', { links: linked })}`;
  }

  #notifyMonthDeleteError(): void {
    openMutationErrorSnackbar(
      this.#transloco.translate('budget.monthDeleteError'),
      this.#snackBar,
      this.#transloco,
    );
  }

  protected async openAddBudgetLineDialog(): Promise<void> {
    const budget = this.store.budgetDetails();
    if (!budget) return;

    const result = await this.#dialogService.openAddBudgetLineDialog({
      id: budget.id,
      month: budget.month,
      year: budget.year,
    });
    if (!result) return;
    if (result.mode === 'spread') {
      await submitSpreadWithRetry(
        result.value,
        (value) =>
          this.#dialogService.runSpreadProcessing(
            () => this.store.createBudgetLineSpread(value),
            {
              ...spreadCreateEcho(value),
              currency: this.userSettingsStore.currency(),
            },
          ),
        this.#snackBar,
        this.#transloco,
      );
    } else if (result.mode === 'savingsWithdrawal') {
      await this.#openSavingsWithdrawalFlow(budget, result.prefill);
    } else {
      const error = await this.store.createBudgetLine(result.value);
      if (error) {
        openMutationErrorSnackbar(error, this.#snackBar, this.#transloco);
      }
    }
  }

  protected async openSavingsWithdrawalFromCard(): Promise<void> {
    const budget = this.store.budgetDetails();
    if (!budget) return;
    await this.#openSavingsWithdrawalFlow(budget);
  }

  async #openSavingsWithdrawalFlow(
    budget: { id: string; month: number; year: number },
    prefill?: {
      amount: number;
      source: string;
      inputCurrency: SupportedCurrency;
    },
  ): Promise<void> {
    const dto = await this.#dialogService.openSavingsWithdrawalDialog({
      budgetId: budget.id,
      budgetMonth: budget.month,
      budgetYear: budget.year,
      deficitAmount: this.store.savingsWithdrawalDeficit(),
      prefill,
    });
    if (!dto) return;
    await submitSavingsWithdrawalWithRetry(
      dto,
      (value) => this.store.createSavingsWithdrawal(value),
      this.#snackBar,
      this.#transloco,
    );
  }
}
