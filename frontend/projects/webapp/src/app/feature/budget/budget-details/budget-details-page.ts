import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  computed,
  effect,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BaseLoading } from '@ui/loading';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { DatePipe } from '@angular/common';
import { Logger } from '@core/logging/logger';
import { formatDate } from 'date-fns';
import { frCH } from 'date-fns/locale';
import { BudgetDetailsStore } from './store/budget-details-store';
import { BudgetLineApi } from './budget-line-api/budget-line-api';
import { BudgetTable } from './budget-table/budget-table';
import { BudgetFinancialOverview } from './budget-financial-overview';
import {
  AddBudgetLineDialog,
  type BudgetLineDialogData,
} from './create-budget-line/add-budget-line-dialog';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@ui/dialogs/confirmation-dialog';
import {
  type BudgetLineCreate,
  type BudgetLineUpdate,
  type BudgetLine,
  type Transaction,
} from '@pulpe/shared';
import { ProductTourService } from '@core/product-tour/product-tour.service';

@Component({
  selector: 'pulpe-budget-details-page',
  imports: [
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
    DatePipe,
    BudgetTable,
    BudgetFinancialOverview,
    BaseLoading,
  ],
  providers: [BudgetDetailsStore, BudgetLineApi],
  template: `
    <div class="flex flex-col gap-6" data-testid="budget-detail-page">
      @if (store.isLoading()) {
        <pulpe-base-loading
          message="Chargement des détails du budget..."
          size="large"
          [fullHeight]="true"
          testId="budget-details-loading"
        ></pulpe-base-loading>
      } @else if (store.hasError()) {
        <mat-card class="bg-error-container" appearance="outlined">
          <mat-card-content>
            <div class="flex items-center gap-2 text-on-error-container">
              <mat-icon>error</mat-icon>
              <span>Erreur lors du chargement du budget</span>
            </div>
          </mat-card-content>
        </mat-card>
      } @else if (store.budgetDetails()) {
        @let budget = store.budgetDetails()!;
        @let budgetLines = store.displayBudgetLines();
        @let transactions = budget.transactions;

        <!-- Header -->
        <header class="flex items-start gap-4">
          <button
            matIconButton
            (click)="navigateBack()"
            aria-label="Retour aux budgets"
            data-testid="back-button"
            class="mt-1"
          >
            <mat-icon>arrow_back</mat-icon>
          </button>
          <div class="flex-1">
            <h1 class="text-display-small mb-2">
              {{ displayName() }}
            </h1>
            @if (budget.description) {
              <p class="text-body-large text-on-surface-variant">
                {{ budget.description }}
              </p>
            }
          </div>
          <button
            matIconButton
            (click)="startPageTour()"
            matTooltip="Découvrir cette page"
            aria-label="Aide"
            data-testid="help-button"
            class="mt-1"
          >
            <mat-icon>help_outline</mat-icon>
          </button>
        </header>

        <!-- Financial Overview -->
        <pulpe-budget-financial-overview
          [budgetLines]="budgetLines"
          [transactions]="transactions"
          data-tour="financial-overview"
        />

        <!-- Budget Items Table -->
        <pulpe-budget-table
          [budgetLines]="budgetLines"
          [transactions]="transactions"
          (update)="handleUpdateBudgetLine($event)"
          (delete)="handleDeleteItem($event)"
          (add)="openAddBudgetLineDialog()"
          data-tour="budget-table"
        />

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
            <mat-card-title>Informations du budget</mat-card-title>
            <mat-card-subtitle>Détails et métadonnées</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <div class="text-label-medium text-on-surface-variant">
                  Période
                </div>
                <p class="text-body-large">
                  {{ displayName() }}
                </p>
              </div>
              <div>
                <div class="text-label-medium text-on-surface-variant">
                  Créé le
                </div>
                <p class="text-body-large">
                  {{ budget.createdAt | date: 'short' : '' : 'fr-CH' }}
                </p>
              </div>
              <div>
                <div class="text-label-medium text-on-surface-variant">
                  Dernière modification
                </div>
                <p class="text-body-large">
                  {{ budget.updatedAt | date: 'short' : '' : 'fr-CH' }}
                </p>
              </div>
              <div>
                <div class="text-label-medium text-on-surface-variant">
                  ID du budget
                </div>
                <p class="text-body-small font-mono text-on-surface-variant">
                  {{ budget.id }}
                </p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      } @else {
        <div class="flex justify-center items-center h-full">
          <p class="text-body-large">Aucun budget trouvé</p>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class BudgetDetailsPage {
  store = inject(BudgetDetailsStore);
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #dialog = inject(MatDialog);
  readonly #snackBar = inject(MatSnackBar);
  readonly #logger = inject(Logger);
  readonly #productTourService = inject(ProductTourService);

  id = input.required<string>();

  constructor() {
    // React to ID changes automatically - this handles route parameter changes
    effect(() => {
      const budgetId = this.id();
      if (budgetId) {
        this.store.setBudgetId(budgetId);
      }
    });

    // Auto-trigger tour on first visit
    afterNextRender(() => {
      if (!this.#productTourService.hasSeenPageTour('budget-details')) {
        setTimeout(
          () => this.#productTourService.startPageTour('budget-details'),
          500,
        );
      }
    });
  }

  startPageTour(): void {
    this.#productTourService.startPageTour('budget-details');
  }

  navigateBack(): void {
    this.#router.navigate(['..'], { relativeTo: this.#route });
  }

  displayName = computed(() => {
    const budget = this.store.budgetDetails();
    if (!budget) return '';
    const date = new Date(budget.year, budget.month - 1, 1);
    return formatDate(date, 'MMMM yyyy', { locale: frCH });
  });

  async openAddBudgetLineDialog(): Promise<void> {
    const budget = this.store.budgetDetails();
    if (!budget) return;

    const dialogRef = this.#dialog.open(AddBudgetLineDialog, {
      data: {
        budgetId: budget.id,
      } satisfies BudgetLineDialogData,
      width: '600px',
      maxWidth: '90vw',
    });

    const budgetLine = await firstValueFrom(dialogRef.afterClosed());
    if (budgetLine) {
      this.handleCreateBudgetLine(budgetLine);
    }
  }

  async handleCreateBudgetLine(budgetLine: BudgetLineCreate): Promise<void> {
    await this.store.createBudgetLine(budgetLine);
  }

  async handleUpdateBudgetLine(data: BudgetLineUpdate): Promise<void> {
    await this.store.updateBudgetLine(data);

    this.#snackBar.open('Prévision modifiée.', 'Fermer', {
      duration: 5000,
      panelClass: ['bg-[color-primary]', 'text-[color-on-primary]'],
    });
  }

  async handleDeleteItem(id: string): Promise<void> {
    const data = this.store.budgetDetails();
    if (!data) return;

    // Find the item to determine if it's a budget line or transaction
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
      ? 'Supprimer la prévision'
      : 'Supprimer la transaction';
    const message = isBudgetLine
      ? 'Êtes-vous sûr de vouloir supprimer cette prévision ?'
      : 'Êtes-vous sûr de vouloir supprimer cette transaction ?';

    const dialogRef = this.#dialog.open(ConfirmationDialog, {
      data: {
        title,
        message,
        confirmText: 'Supprimer',
        confirmColor: 'warn',
      } satisfies ConfirmationDialogData,
      width: '400px',
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());

    if (!confirmed) {
      return;
    }

    if (isBudgetLine) {
      await this.store.deleteBudgetLine(id);
    } else {
      await this.store.deleteTransaction(id);

      this.#snackBar.open('Transaction supprimée.', 'Fermer', {
        duration: 5000,
        panelClass: ['bg-[color-primary]', 'text-[color-on-primary]'],
      });
    }
  }
}
