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
import { DatePipe } from '@angular/common';
import { BudgetApi } from '@core/budget/budget-api';
import { formatDate } from 'date-fns';
import { frCH } from 'date-fns/locale';

@Component({
  selector: 'pulpe-details-page',
  imports: [MatCardModule, MatIconModule, MatButtonModule, DatePipe],
  template: `
    <div class="flex flex-col gap-6">
      @if (budgetData.isLoading()) {
        <div class="flex justify-center py-8">
          <mat-icon class="animate-spin">refresh</mat-icon>
          <span class="ml-2">Chargement...</span>
        </div>
      } @else if (budgetData.error()) {
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
        @let budget = budgetData.value()!;
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

        <!-- Placeholder for future budget details -->
        <mat-card>
          <mat-card-header>
            <div mat-card-avatar>
              <div
                class="flex justify-center items-center size-11 bg-[color-secondary-container] rounded-full"
              >
                <mat-icon class="text-[color-on-secondary-container]"
                  >account_balance_wallet</mat-icon
                >
              </div>
            </div>
            <mat-card-title>Détails du budget</mat-card-title>
            <mat-card-subtitle
              >Catégories et transactions (à implémenter)</mat-card-subtitle
            >
          </mat-card-header>
          <mat-card-content>
            <p class="text-body-medium text-[color-on-surface-variant] py-4">
              Les détails des catégories de budget et des transactions seront
              affichés ici.
            </p>
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
  #budgetApi = inject(BudgetApi);
  #router = inject(Router);
  #route = inject(ActivatedRoute);

  id = input.required<string>();

  budgetData = resource({
    params: () => this.id(),
    loader: async ({ params: budgetId }) =>
      firstValueFrom(this.#budgetApi.getBudgetById$(budgetId)),
  });

  navigateBack(): void {
    this.#router.navigate(['..'], { relativeTo: this.#route });
  }

  getDisplayName(month: number, year: number): string {
    const date = new Date(year, month - 1, 1);
    return formatDate(date, 'MMMM yyyy', { locale: frCH });
  }
}
