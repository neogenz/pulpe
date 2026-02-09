import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  computed,
  effect,
  isDevMode,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DatePipe } from '@angular/common';
import type { BudgetLineConsumption } from '@core/budget';
import { Logger } from '@core/logging/logger';
import { BreadcrumbState } from '@core/routing';
import {
  ProductTourService,
  TOUR_START_DELAY,
} from '@core/product-tour/product-tour.service';
import { formatDate } from 'date-fns';
import { frCH } from 'date-fns/locale';
import { BaseLoading } from '@ui/loading';
import { BudgetDetailsStore } from './store/budget-details-store';
import { BudgetLineApi } from './budget-line-api/budget-line-api';
import { BudgetItemsContainer } from './budget-items-container';
import { BudgetFinancialOverview } from './budget-financial-overview';
import { BudgetDetailsDialogService } from './budget-details-dialog.service';
import {
  type BudgetLineCreate,
  type BudgetLineUpdate,
  type BudgetLine,
  type Transaction,
  formatBudgetPeriod,
} from 'pulpe-shared';
import { UserSettingsApi } from '@core/user-settings/user-settings-api';

@Component({
  selector: 'pulpe-budget-details-page',
  imports: [
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    DatePipe,
    BudgetItemsContainer,
    BudgetFinancialOverview,
    BaseLoading,
  ],
  providers: [BudgetDetailsStore, BudgetLineApi, BudgetDetailsDialogService],
  templateUrl: './budget-details-page.html',
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class BudgetDetailsPage {
  protected readonly isDevMode = isDevMode();
  protected readonly store = inject(BudgetDetailsStore);
  readonly #dialogService = inject(BudgetDetailsDialogService);
  readonly #router = inject(Router);
  readonly #breadcrumbState = inject(BreadcrumbState);
  readonly #productTourService = inject(ProductTourService);
  readonly #snackBar = inject(MatSnackBar);
  readonly #logger = inject(Logger);
  readonly #userSettingsApi = inject(UserSettingsApi);
  readonly #breakpointObserver = inject(BreakpointObserver);

  readonly #isMobile = toSignal(
    this.#breakpointObserver
      .observe(Breakpoints.Handset)
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  readonly id = input.required<string>();

  constructor() {
    effect(() => {
      const budgetId = this.id();
      if (budgetId) {
        this.store.setBudgetId(budgetId);
      }
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

  readonly displayName = computed(() => {
    const budget = this.store.budgetDetails();
    if (!budget) return '';
    const date = new Date(budget.year, budget.month - 1, 1);
    return formatDate(date, 'MMMM yyyy', { locale: frCH });
  });

  readonly periodDisplay = computed(() => {
    const budget = this.store.budgetDetails();
    const payDayOfMonth = this.#userSettingsApi.payDayOfMonth();
    if (!budget || !payDayOfMonth || payDayOfMonth === 1) return null;
    return formatBudgetPeriod(budget.month, budget.year, payDayOfMonth);
  });

  async openAddBudgetLineDialog(): Promise<void> {
    const budget = this.store.budgetDetails();
    if (!budget) return;

    const budgetLine = await this.#dialogService.openAddBudgetLineDialog(
      budget.id,
    );
    if (budgetLine) {
      await this.handleCreateBudgetLine(budgetLine);
    }
  }

  async handleCreateBudgetLine(budgetLine: BudgetLineCreate): Promise<void> {
    await this.store.createBudgetLine(budgetLine);
  }

  async handleUpdateBudgetLine(data: BudgetLineUpdate): Promise<void> {
    await this.store.updateBudgetLine(data);

    this.#snackBar.open('Modification enregistrée', 'Fermer', {
      duration: 5000,
      panelClass: ['bg-[color-primary]', 'text-[color-on-primary]'],
    });
  }

  async handleDeleteItem(id: string): Promise<void> {
    const data = this.store.budgetDetails();
    if (!data) return;

    const budgetLine = data.budgetLines.find(
      (line: BudgetLine) => line.id === id,
    );
    const transaction = data.transactions.find(
      (tx: Transaction) => tx.id === id,
    );

    if (!budgetLine && !transaction) {
      this.#logger.error('Item not found', { id, budgetId: this.id() });
      return;
    }

    const isBudgetLine = !!budgetLine;
    const title = isBudgetLine
      ? 'Supprimer cette prévision ?'
      : 'Supprimer cette transaction ?';
    const message = 'Cette action est irréversible.';

    const confirmed = await this.#dialogService.confirmDelete({
      title,
      message,
    });

    if (!confirmed) return;

    if (isBudgetLine) {
      await this.store.deleteBudgetLine(id);
    } else {
      await this.store.deleteTransaction(id);

      this.#snackBar.open('Transaction supprimée', 'Fermer', {
        duration: 5000,
        panelClass: ['bg-[color-primary]', 'text-[color-on-primary]'],
      });
    }
  }

  async openAllocatedTransactionsDialog(event: {
    budgetLine: BudgetLine;
    consumption: BudgetLineConsumption;
  }): Promise<void> {
    const result = await this.#dialogService.openAllocatedTransactionsDialog(
      event,
      this.#isMobile(),
      {
        onToggleTransactionCheck: (id) => this.handleToggleTransactionCheck(id),
      },
    );

    if (!result) return;

    if (result.action === 'add') {
      await this.openCreateAllocatedTransactionDialog(event.budgetLine);
    } else if (result.action === 'delete' && result.transaction) {
      await this.handleDeleteTransaction(result.transaction);
    }
  }

  async openCreateAllocatedTransactionDialog(
    budgetLine: BudgetLine,
  ): Promise<void> {
    const budget = this.store.budgetDetails();
    if (!budget) {
      this.#logger.warn(
        'Cannot open create transaction dialog: budget not loaded',
      );
      return;
    }

    const transaction =
      await this.#dialogService.openCreateAllocatedTransactionDialog(
        budgetLine,
        this.#isMobile(),
        {
          budgetMonth: budget.month,
          budgetYear: budget.year,
          payDayOfMonth: this.#userSettingsApi.payDayOfMonth(),
        },
      );

    if (transaction) {
      await this.store.createAllocatedTransaction(transaction);

      this.#snackBar.open('Transaction ajoutée', 'Fermer', {
        duration: 3000,
      });
    }
  }

  async handleDeleteTransaction(transaction: Transaction): Promise<void> {
    const confirmed = await this.#dialogService.confirmDelete({
      title: 'Supprimer cette transaction ?',
      message: `Tu vas supprimer « ${transaction.name} ». Cette action est irréversible.`,
    });

    if (confirmed) {
      await this.store.deleteTransaction(transaction.id);

      this.#snackBar.open('Transaction supprimée', 'Fermer', {
        duration: 3000,
      });
    }
  }

  async handleResetFromTemplate(budgetLineId: string): Promise<void> {
    try {
      await this.store.resetBudgetLineFromTemplate(budgetLineId);

      this.#snackBar.open(
        'Prévision réinitialisée depuis le modèle',
        'Fermer',
        {
          duration: 5000,
          panelClass: ['bg-[color-primary]', 'text-[color-on-primary]'],
        },
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';

      this.#snackBar.open(errorMessage, 'Fermer', {
        duration: 5000,
        panelClass: ['bg-error-container', 'text-on-error-container'],
      });
    }
  }

  async handleToggleCheck(budgetLineId: string): Promise<void> {
    if (budgetLineId.startsWith('rollover')) {
      await this.store.toggleCheck(budgetLineId);
      return;
    }

    const details = this.store.budgetDetails();
    const budgetLine = details?.budgetLines.find(
      (line) => line.id === budgetLineId,
    );
    const isBeingChecked = budgetLine && !budgetLine.checkedAt;

    await this.store.toggleCheck(budgetLineId);

    if (!isBeingChecked || !budgetLine) return;

    const consumed = details!.transactions
      .filter(
        (tx) =>
          tx.budgetLineId === budgetLineId &&
          tx.checkedAt != null &&
          (tx.kind === 'expense' || tx.kind === 'saving'),
      )
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    const envelopeAmount = Math.abs(budgetLine.amount);
    if (envelopeAmount <= consumed || consumed === 0) return;

    this.#snackBar.open(
      `Comptabilisé ${envelopeAmount} CHF (enveloppe)`,
      undefined,
      { duration: 3000 },
    );
  }

  async handleToggleTransactionCheck(transactionId: string): Promise<void> {
    await this.store.toggleTransactionCheck(transactionId);
  }
}
