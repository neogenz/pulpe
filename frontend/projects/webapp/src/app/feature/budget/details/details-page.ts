import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
  computed,
} from '@angular/core';
import { resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe } from '@angular/common';
import { formatDate } from 'date-fns';
import { frCH } from 'date-fns/locale';
import { BudgetLineApi } from './services/budget-line-api';
import { BudgetLinesTable } from './components/budget-lines-table';
import { BudgetLineForm } from './components/budget-line-form';
import { BudgetFinancialOverview } from './components/budget-financial-overview';
import {
  type BudgetLine,
  type BudgetLineCreate,
  type BudgetLineUpdate,
} from '@pulpe/shared';

@Component({
  selector: 'pulpe-details-page',
  imports: [
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    DatePipe,
    BudgetLinesTable,
    BudgetLineForm,
    BudgetFinancialOverview,
  ],
  providers: [BudgetLineApi],
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
        @let budgetLines = currentBudgetLines();

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
          @if (hasUnsavedChanges()) {
            <button
              mat-filled-button
              color="primary"
              (click)="saveChanges()"
              [disabled]="isSaving()"
              data-testid="save-changes"
            >
              <mat-icon>save</mat-icon>
              Enregistrer les modifications
            </button>
          }
        </header>

        <!-- Financial Overview -->
        <pulpe-budget-financial-overview [budgetLines]="budgetLines" />

        <!-- Add Budget Line Form -->
        @if (showAddForm()) {
          <pulpe-budget-line-form
            [budgetId]="budget.id"
            (submitted)="handleCreateBudgetLine($event)"
            (cancelled)="showAddForm.set(false)"
          />
        }

        <!-- Budget Lines Table -->
        <pulpe-budget-lines-table
          [budgetLines]="budgetLines"
          (updateClicked)="handleUpdateBudgetLine($event.id, $event.update)"
          (deleteClicked)="handleDeleteBudgetLine($event)"
          (addClicked)="showAddForm.set(true)"
        />

        <!-- Budget Info Card -->
        <mat-card>
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

  id = input.required<string>();

  // State signals
  showAddForm = signal(false);
  isSaving = signal(false);

  // Track changes
  originalBudgetLines = signal<BudgetLine[]>([]);
  modifiedBudgetLines = signal<BudgetLine[]>([]);
  deletedLineIds = signal<string[]>([]);
  newBudgetLines = signal<BudgetLine[]>([]);

  // Load budget details
  budgetDetails = resource({
    params: () => this.id(),
    loader: async ({ params: budgetId }) => {
      const details = await firstValueFrom(
        this.#budgetLineApi.getBudgetDetails$(budgetId),
      );
      // Initialize state with loaded data
      this.originalBudgetLines.set([...details.data.budgetLines]);
      this.modifiedBudgetLines.set([...details.data.budgetLines]);
      this.deletedLineIds.set([]);
      this.newBudgetLines.set([]);
      return details;
    },
  });

  // Computed values
  currentBudgetLines = computed(() => {
    const modified = this.modifiedBudgetLines();
    const newLines = this.newBudgetLines();
    const deletedIds = this.deletedLineIds();

    return [
      ...modified.filter((line) => !deletedIds.includes(line.id)),
      ...newLines,
    ];
  });

  hasUnsavedChanges = computed(() => {
    const original = this.originalBudgetLines();
    const modified = this.modifiedBudgetLines();
    const deleted = this.deletedLineIds();
    const newLines = this.newBudgetLines();

    // Check if any new lines were added
    if (newLines.length > 0) return true;

    // Check if any lines were deleted
    if (deleted.length > 0) return true;

    // Check if any lines were modified
    return modified.some((line, index) => {
      const originalLine = original[index];
      if (!originalLine) return true;
      return (
        line.name !== originalLine.name || line.amount !== originalLine.amount
      );
    });
  });

  navigateBack(): void {
    this.#router.navigate(['..'], { relativeTo: this.#route });
  }

  getDisplayName(month: number, year: number): string {
    const date = new Date(year, month - 1, 1);
    return formatDate(date, 'MMMM yyyy', { locale: frCH });
  }

  handleCreateBudgetLine(budgetLine: BudgetLineCreate): void {
    // Create a temporary budget line with a fake ID
    const tempLine: BudgetLine = {
      ...budgetLine,
      id: `temp-${Date.now()}`,
      templateLineId: null,
      savingsGoalId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.newBudgetLines.update((lines) => [...lines, tempLine]);
    this.showAddForm.set(false);

    this.#snackBar.open(
      'Ligne ajoutée. Cliquez sur "Enregistrer" pour sauvegarder.',
      'OK',
      {
        duration: 3000,
      },
    );
  }

  handleUpdateBudgetLine(id: string, update: BudgetLineUpdate): void {
    // Check if it's a new line
    const newLineIndex = this.newBudgetLines().findIndex(
      (line) => line.id === id,
    );
    if (newLineIndex >= 0) {
      this.newBudgetLines.update((lines) => {
        const updated = [...lines];
        updated[newLineIndex] = { ...updated[newLineIndex], ...update };
        return updated;
      });
    } else {
      // Update existing line
      this.modifiedBudgetLines.update((lines) => {
        return lines.map((line) =>
          line.id === id ? { ...line, ...update } : line,
        );
      });
    }
  }

  handleDeleteBudgetLine(id: string): void {
    // Check if it's a new line
    const newLineIndex = this.newBudgetLines().findIndex(
      (line) => line.id === id,
    );
    if (newLineIndex >= 0) {
      this.newBudgetLines.update((lines) =>
        lines.filter((line) => line.id !== id),
      );
    } else {
      // Mark existing line for deletion
      this.deletedLineIds.update((ids) => [...ids, id]);
    }

    this.#snackBar.open(
      'Ligne supprimée. Cliquez sur "Enregistrer" pour confirmer.',
      'OK',
      {
        duration: 3000,
      },
    );
  }

  async saveChanges(): Promise<void> {
    this.isSaving.set(true);

    try {
      const promises: Promise<void>[] = [];

      // Create new lines
      for (const newLine of this.newBudgetLines()) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, createdAt, updatedAt, ...createData } = newLine;
        promises.push(
          firstValueFrom(
            this.#budgetLineApi.createBudgetLine$(createData),
          ).then(() => undefined),
        );
      }

      // Update modified lines
      const original = this.originalBudgetLines();
      const modified = this.modifiedBudgetLines();

      modified.forEach((line, index) => {
        const originalLine = original[index];
        if (
          originalLine &&
          (line.name !== originalLine.name ||
            line.amount !== originalLine.amount)
        ) {
          const update: BudgetLineUpdate = {
            name: line.name,
            amount: line.amount,
          };
          promises.push(
            firstValueFrom(
              this.#budgetLineApi.updateBudgetLine$(line.id, update),
            ).then(() => undefined),
          );
        }
      });

      // Delete lines
      for (const id of this.deletedLineIds()) {
        promises.push(
          firstValueFrom(this.#budgetLineApi.deleteBudgetLine$(id)).then(
            () => undefined,
          ),
        );
      }

      // Execute all operations
      await Promise.all(promises);

      // Reload data
      this.budgetDetails.reload();

      this.#snackBar.open('Modifications enregistrées avec succès', 'OK', {
        duration: 3000,
      });
    } catch (error) {
      this.#snackBar.open(
        "Erreur lors de l'enregistrement des modifications",
        'OK',
        {
          duration: 5000,
        },
      );
      console.error('Error saving changes:', error);
    } finally {
      this.isSaving.set(false);
    }
  }
}
