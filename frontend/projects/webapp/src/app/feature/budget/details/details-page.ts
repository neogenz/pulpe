import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { DatePipe } from '@angular/common';
import { formatDate } from 'date-fns';
import { frCH } from 'date-fns/locale';
import { BudgetLineApi } from './services/budget-line-api';
import { BudgetLinesTable } from './components/budget-lines-table';
import { BudgetFinancialOverview } from './components/budget-financial-overview';
import {
  BudgetLineDialog,
  type BudgetLineDialogData,
} from './components/budget-line-dialog';
import {
  ConfirmationDialogComponent,
  type ConfirmationDialogData,
} from '../../../ui/dialogs/confirmation-dialog';
import { type BudgetLineCreate, type BudgetLineUpdate } from '@pulpe/shared';

@Component({
  selector: 'pulpe-details-page',
  imports: [
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    DatePipe,
    BudgetLinesTable,
    BudgetFinancialOverview,
  ],
  template: `
    <div class="flex flex-col gap-6">
      @if (budgetDetails.isLoading()) {
        <div class="flex justify-center py-8">
          <mat-spinner diameter="40"></mat-spinner>
          <span class="ml-2">Chargement...</span>
        </div>
      } @else if (budgetDetails.error()) {
        <mat-card class="bg-[color-error-container]">
          <mat-card-content>
            <div
              class="flex items-center gap-2 text-[color-on-error-container]"
            >
              <mat-icon>error</mat-icon>
              <span>Erreur lors du chargement du budget</span>
            </div>
          </mat-card-content>
        </mat-card>
      } @else {
        @let data = budgetDetails.value()!;
        @let budget = data.data.budget;
        @let budgetLines = data.data.budgetLines;

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
              {{ getDisplayName(budget.month, budget.year) }}
            </h1>
            @if (budget.description) {
              <p class="text-body-large text-[color-on-surface-variant]">
                {{ budget.description }}
              </p>
            }
          </div>
        </header>

        <!-- Financial Overview -->
        <pulpe-budget-financial-overview [budgetLines]="budgetLines" />

        <!-- Budget Lines Table -->
        <pulpe-budget-lines-table
          [budgetLines]="budgetLines"
          (updateClicked)="handleUpdateBudgetLine($event.id, $event.update)"
          (deleteClicked)="handleDeleteBudgetLine($event)"
          (addClicked)="openAddBudgetLineDialog()"
        />

        <!-- Budget Info Card -->
        <mat-card appearance="outlined">
          <mat-card-header>
            <div mat-card-avatar>
              <div
                class="flex justify-center items-center size-11 bg-[color-primary-container] rounded-full"
              >
                <mat-icon class="text-[color-on-primary-container]"
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
                <div class="text-label-medium text-[color-on-surface-variant]">
                  Période
                </div>
                <p class="text-body-large">
                  {{ getDisplayName(budget.month, budget.year) }}
                </p>
              </div>
              <div>
                <div class="text-label-medium text-[color-on-surface-variant]">
                  Créé le
                </div>
                <p class="text-body-large">
                  {{ budget.createdAt | date: 'short' : '' : 'fr-CH' }}
                </p>
              </div>
              <div>
                <div class="text-label-medium text-[color-on-surface-variant]">
                  Dernière modification
                </div>
                <p class="text-body-large">
                  {{ budget.updatedAt | date: 'short' : '' : 'fr-CH' }}
                </p>
              </div>
              <div>
                <div class="text-label-medium text-[color-on-surface-variant]">
                  ID du budget
                </div>
                <p
                  class="text-body-small font-mono text-[color-on-surface-variant]"
                >
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
  #budgetLineApi = inject(BudgetLineApi);
  #router = inject(Router);
  #route = inject(ActivatedRoute);
  #snackBar = inject(MatSnackBar);
  #dialog = inject(MatDialog);

  id = input.required<string>();

  // Load budget details
  budgetDetails = resource({
    params: () => this.id(),
    loader: async ({ params: budgetId }) => {
      return await firstValueFrom(
        this.#budgetLineApi.getBudgetDetails$(budgetId),
      );
    },
  });

  navigateBack(): void {
    this.#router.navigate(['..'], { relativeTo: this.#route });
  }

  getDisplayName(month: number, year: number): string {
    const date = new Date(year, month - 1, 1);
    return formatDate(date, 'MMMM yyyy', { locale: frCH });
  }

  async openAddBudgetLineDialog(): Promise<void> {
    const budget = this.budgetDetails.value()?.data.budget;
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
    try {
      await firstValueFrom(this.#budgetLineApi.createBudgetLine$(budgetLine));

      // Reload data to reflect changes
      this.budgetDetails.reload();

      this.#snackBar.open('Prévision ajoutée.', 'OK', {
        duration: 3000,
      });
    } catch (error) {
      this.#snackBar.open("Erreur lors de l'ajout de la prévision", 'OK', {
        duration: 5000,
      });
      console.error('Error creating budget line:', error);
    }
  }

  async handleUpdateBudgetLine(
    id: string,
    update: BudgetLineUpdate,
  ): Promise<void> {
    try {
      await firstValueFrom(this.#budgetLineApi.updateBudgetLine$(id, update));

      // Reload data to reflect changes
      this.budgetDetails.reload();

      this.#snackBar.open('Prévision modifiée.', 'OK', {
        duration: 3000,
      });
    } catch (error) {
      this.#snackBar.open(
        'Erreur lors de la modification de la prévision',
        'OK',
        {
          duration: 5000,
        },
      );
      console.error('Error updating budget line:', error);
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

    try {
      await firstValueFrom(this.#budgetLineApi.deleteBudgetLine$(id));

      // Reload data to reflect changes
      this.budgetDetails.reload();

      this.#snackBar.open('Prévision supprimée.', 'OK', {
        duration: 3000,
      });
    } catch (error) {
      this.#snackBar.open(
        'Erreur lors de la suppression de la prévision',
        'OK',
        {
          duration: 5000,
        },
      );
      console.error('Error deleting budget line:', error);
    }
  }
}
