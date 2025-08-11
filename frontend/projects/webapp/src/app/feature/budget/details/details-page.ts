import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  computed,
  OnInit,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { BaseLoadingComponent } from '../../../ui/loading';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { DatePipe } from '@angular/common';
import { formatDate } from 'date-fns';
import { frCH } from 'date-fns/locale';
import { BudgetDetailsState } from './services/budget-details-state';
import { BudgetLineApi } from './services/budget-line-api';
import { BudgetItemsTable } from './components/budget-items-table';
import { BudgetFinancialOverview } from './components/budget-financial-overview';
import {
  BudgetLineDialog,
  type BudgetLineDialogData,
} from './components/budget-line-dialog';
import {
  ConfirmationDialogComponent,
  type ConfirmationDialogData,
} from '../../../ui/dialogs/confirmation-dialog';
import {
  type BudgetLineCreate,
  type BudgetLineUpdate,
  type TransactionKind,
  type TransactionRecurrence,
} from '@pulpe/shared';

interface BudgetItemViewModel {
  id: string;
  name: string;
  amount: number;
  kind: TransactionKind;
  recurrence: TransactionRecurrence;
  itemType: 'budget_line' | 'transaction';
  kindIcon: string;
  kindLabel: string;
  kindIconClass: string;
  amountClass: string;
  recurrenceLabel: string;
  recurrenceChipClass: string;
  isEditing: boolean;
  isLoading: boolean;
}

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
    BaseLoadingComponent,
  ],
  providers: [BudgetDetailsState, BudgetLineApi],
  template: `
    <div class="flex flex-col gap-6">
      @if (budgetDetailsState.budgetDetails.isLoading()) {
        <pulpe-base-loading
          message="Chargement des détails du budget..."
          size="large"
          [fullHeight]="true"
          testId="budget-details-loading"
        ></pulpe-base-loading>
      } @else if (budgetDetailsState.budgetDetails.error()) {
        <mat-card class="bg-error-container">
          <mat-card-content>
            <div class="flex items-center gap-2 text-on-error-container">
              <mat-icon>error</mat-icon>
              <span>Erreur lors du chargement du budget</span>
            </div>
          </mat-card-content>
        </mat-card>
      } @else {
        @let data = budgetDetailsState.budgetDetails.value()!;
        @let budget = data.data.budget;
        @let budgetLines = data.data.budgetLines;

        <!-- Header -->
        <header class="flex items-start gap-4">
          <button
            mat-icon-button
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
        <pulpe-budget-financial-overview [budgetLines]="budgetLines" />

        <!-- Budget Items Table -->
        <pulpe-budget-items-table
          [budgetItems]="budgetItemViewModels()"
          [operationsInProgress]="budgetDetailsState.operationsInProgress()"
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
export default class DetailsPage implements OnInit {
  budgetDetailsState = inject(BudgetDetailsState);
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #dialog = inject(MatDialog);

  id = input.required<string>();

  ngOnInit(): void {
    // Initialize the budget ID - input is guaranteed to be available in ngOnInit
    this.budgetDetailsState.initializeBudgetId(this.id());
  }

  navigateBack(): void {
    this.#router.navigate(['..'], { relativeTo: this.#route });
  }

  displayName = computed(() => {
    const budget = this.budgetDetailsState.budgetDetails.value()?.data.budget;
    if (!budget) return '';
    const date = new Date(budget.year, budget.month - 1, 1);
    return formatDate(date, 'MMMM yyyy', { locale: frCH });
  });

  // Unified budget items view model
  budgetItemViewModels = computed(() => {
    const data = this.budgetDetailsState.budgetDetails.value()?.data;
    if (!data) return [];

    const inProgress = this.budgetDetailsState.operationsInProgress();
    const editingId = null; // TODO: gérer l'édition plus tard

    // Map budget lines
    const budgetLineViewModels: BudgetItemViewModel[] = data.budgetLines.map(
      (line) => ({
        id: line.id,
        name: line.name,
        amount: line.amount,
        kind: line.kind,
        recurrence: line.recurrence,
        itemType: 'budget_line' as const,
        kindIcon: this.#kindIcons[line.kind],
        kindLabel: this.#kindLabels[line.kind],
        kindIconClass: this.#kindIconClasses[line.kind],
        amountClass: this.#amountClasses[line.kind],
        recurrenceLabel: this.#recurrenceLabels[line.recurrence],
        recurrenceChipClass: this.#recurrenceChipClasses[line.recurrence],
        isEditing: editingId === line.id,
        isLoading: inProgress.has(line.id),
      }),
    );

    // Map transactions (always one-off)
    const transactionViewModels: BudgetItemViewModel[] = data.transactions.map(
      (transaction) => ({
        id: transaction.id,
        name: transaction.name,
        amount: transaction.amount,
        kind: transaction.kind,
        recurrence: 'one_off' as const, // Transactions are always one-off
        itemType: 'transaction' as const,
        kindIcon: this.#kindIcons[transaction.kind],
        kindLabel: this.#kindLabels[transaction.kind],
        kindIconClass: this.#kindIconClasses[transaction.kind],
        amountClass: this.#amountClasses[transaction.kind],
        recurrenceLabel: this.#recurrenceLabels['one_off'],
        recurrenceChipClass: this.#recurrenceChipClasses['one_off'],
        isEditing: false, // Transactions cannot be edited in this view
        isLoading: inProgress.has(transaction.id),
      }),
    );

    // Combine and sort by amount (descending) then by name
    return [...budgetLineViewModels, ...transactionViewModels].sort((a, b) => {
      if (a.amount !== b.amount) {
        return b.amount - a.amount;
      }
      return a.name.localeCompare(b.name);
    });
  });

  // Mapping constants (same as in BudgetLinesTable)
  #kindIcons: Record<TransactionKind, string> = {
    income: 'trending_up',
    expense: 'trending_down',
    saving: 'savings',
  };

  #kindLabels: Record<TransactionKind, string> = {
    income: 'Revenu',
    expense: 'Dépense',
    saving: 'Épargne',
  };

  #kindIconClasses: Record<TransactionKind, string> = {
    income: 'text-financial-income',
    expense: 'text-financial-negative',
    saving: 'text-primary',
  };

  #amountClasses: Record<TransactionKind, string> = {
    income: 'text-financial-income',
    expense: 'text-financial-negative',
    saving: 'text-primary',
  };

  #recurrenceLabels: Record<TransactionRecurrence, string> = {
    fixed: 'Tous les mois',
    variable: 'Variable',
    one_off: 'Une seule fois',
  };

  #recurrenceChipClasses: Record<TransactionRecurrence, string> = {
    fixed: 'bg-primary-container text-on-primary-container',
    variable: 'bg-tertiary-container text-on-tertiary-container',
    one_off: 'bg-secondary-container text-on-secondary-container',
  };

  async openAddBudgetLineDialog(): Promise<void> {
    const budget = this.budgetDetailsState.budgetDetails.value()?.data.budget;
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
    await this.budgetDetailsState.createBudgetLine(budgetLine);
  }

  async handleUpdateBudgetLine(
    id: string,
    update: BudgetLineUpdate,
  ): Promise<void> {
    await this.budgetDetailsState.updateBudgetLine(id, update);
  }

  async handleDeleteItem(id: string): Promise<void> {
    // Find the item to determine if it's a budget line or transaction
    const item = this.budgetItemViewModels().find((item) => item.id === id);
    if (!item) return;

    const isBudgetLine = item.itemType === 'budget_line';
    const title = isBudgetLine
      ? 'Supprimer la prévision'
      : 'Supprimer la transaction';
    const message = isBudgetLine
      ? 'Êtes-vous sûr de vouloir supprimer cette prévision ?'
      : 'Êtes-vous sûr de vouloir supprimer cette transaction ?';

    const dialogRef = this.#dialog.open(ConfirmationDialogComponent, {
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
      await this.budgetDetailsState.deleteBudgetLine(id);
    } else {
      // TODO: Implement transaction deletion
      console.warn('Transaction deletion not yet implemented');
    }
  }

  async handleDeleteBudgetLine(id: string): Promise<void> {
    const dialogRef = this.#dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Supprimer la prévision',
        message: 'Êtes-vous sûr de vouloir supprimer cette prévision ?',
        confirmText: 'Supprimer',
        confirmColor: 'warn',
      } satisfies ConfirmationDialogData,
      width: '400px',
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());

    if (!confirmed) {
      return;
    }

    await this.budgetDetailsState.deleteBudgetLine(id);
  }
}
