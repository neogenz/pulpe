import {
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
import { BaseLoading } from '@ui/loading';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { DatePipe } from '@angular/common';
import { Logger } from '@core/logging/logger';
import { formatDate } from 'date-fns';
import { frCH } from 'date-fns/locale';
import { BudgetDetailsStore } from './services/budget-details-store';
import { BudgetLineApi } from './services/budget-line-api';
import { BudgetItemsTable } from './components/budget-items-table';
import { BudgetFinancialOverview } from './components/budget-financial-overview';
import {
  BudgetLineDialog,
  type BudgetLineDialogData,
} from './components/budget-line-dialog';
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

@Component({
  selector: 'pulpe-details-page',
  imports: [
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    MatDialogModule,
    DatePipe,
    BudgetItemsTable,
    BudgetFinancialOverview,
    BaseLoading,
  ],
  providers: [BudgetDetailsStore, BudgetLineApi],
  template: `
    <div class="flex flex-col gap-6" data-testid="budget-detail-page">
      @if (budgetDetailsStore.isLoading()) {
        <pulpe-base-loading
          message="Chargement des détails du budget..."
          size="large"
          [fullHeight]="true"
          testId="budget-details-loading"
        ></pulpe-base-loading>
      } @else if (budgetDetailsStore.error()) {
        <mat-card class="bg-error-container">
          <mat-card-content>
            <div class="flex items-center gap-2 text-on-error-container">
              <mat-icon>error</mat-icon>
              <span>Erreur lors du chargement du budget</span>
            </div>
          </mat-card-content>
        </mat-card>
      } @else {
        @let data = budgetDetailsStore.budgetData()!;
        @let budget = data.budget;
        @let budgetLines = data.budgetLines;
        @let transactions = data.transactions;

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
        </header>

        <!-- Financial Overview -->
        <pulpe-budget-financial-overview
          [budgetLines]="budgetLines"
          [transactions]="transactions"
        />

        <!-- Budget Items Table -->
        <pulpe-budget-items-table
          [budgetLines]="budgetLines"
          [transactions]="transactions"
          [operationsInProgress]="budgetDetailsStore.operationsInProgress()"
          (updateClicked)="handleUpdateBudgetLine($event.id, $event.update)"
          (deleteClicked)="handleDeleteItem($event)"
          (addClicked)="openAddBudgetLineDialog()"
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
export default class DetailsPage {
  budgetDetailsStore = inject(BudgetDetailsStore);
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #dialog = inject(MatDialog);
  readonly #snackBar = inject(MatSnackBar);
  readonly #logger = inject(Logger);

  id = input.required<string>();

  constructor() {
    // React to ID changes automatically - this handles route parameter changes
    effect(() => {
      const budgetId = this.id();
      if (budgetId) {
        this.budgetDetailsStore.initializeBudgetId(budgetId);
      }
    });
  }

  navigateBack(): void {
    this.#router.navigate(['..'], { relativeTo: this.#route });
  }

  displayName = computed(() => {
    const budget = this.budgetDetailsStore.budgetDetails().value()?.data.budget;
    if (!budget) return '';
    const date = new Date(budget.year, budget.month - 1, 1);
    return formatDate(date, 'MMMM yyyy', { locale: frCH });
  });

  async openAddBudgetLineDialog(): Promise<void> {
    const budget = this.budgetDetailsStore.budgetDetails().value()?.data.budget;
    if (!budget) return;

    const dialogRef = this.#dialog.open(BudgetLineDialog, {
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
    await this.budgetDetailsStore.createBudgetLine(budgetLine);
  }

  async handleUpdateBudgetLine(
    id: string,
    update: BudgetLineUpdate,
  ): Promise<void> {
    await this.budgetDetailsStore.updateBudgetLine(id, update);

    this.#snackBar.open('Prévision modifiée.', 'Fermer', {
      duration: 5000,
      panelClass: ['bg-[color-primary]', 'text-[color-on-primary]'],
    });
  }

  async handleDeleteItem(id: string): Promise<void> {
    const data = this.budgetDetailsStore.budgetData();
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
      await this.budgetDetailsStore.deleteBudgetLine(id);
    } else {
      await this.budgetDetailsStore.deleteTransaction(id);

      this.#snackBar.open('Transaction supprimée.', 'Fermer', {
        duration: 5000,
        panelClass: ['bg-[color-primary]', 'text-[color-on-primary]'],
      });
    }
  }
}
