import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { DecimalPipe } from '@angular/common';
import { MatProgressBarModule } from '@angular/material/progress-bar';

/**
 * BudgetProgressBar - Affiche la progression du budget mensuel
 *
 * Concepts métier:
 * - Dépenses: Total dépensé (expenses + savings) SANS le rollover
 * - Disponible: Total des revenus + rollover (peut être négatif)
 * - Restant: Disponible - Dépenses
 *
 * Calculs:
 * - Pourcentage utilisé = Dépenses / Disponible * 100
 * - Dépassement budget si Restant < 0
 */
@Component({
  selector: 'pulpe-budget-progress-bar',
  imports: [MatCardModule, MatIconModule, DecimalPipe, MatProgressBarModule],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header class="mb-4">
        <div class="flex flex-col gap-3 w-full">
          <!-- Ligne principale: Dépenses sur Disponible -->
          <div class="flex justify-between items-baseline gap-2">
            <div class="flex flex-col">
              <span class="text-body-small md:text-body">Dépenses CHF</span>
              <span class="text-headline-small md:text-headline-large">
                {{ expenses() | number: '1.2-2' : 'fr-CH' }}
              </span>
            </div>
            <div class="flex flex-col text-right text-outline">
              <span class="text-body-small md:text-body">Disponible CHF</span>
              <span class="text-headline-small md:text-headline-large">
                {{ available() | number: '1.2-2' : 'fr-CH' }}
              </span>
            </div>
          </div>

          <!-- Montant restant -->
          <div class="flex items-baseline gap-2">
            <span class="text-body-large text-on-surface-variant">
              @if (!isOverBudget()) {
                Restant:
              } @else {
                Dépassement:
              }
            </span>
            <span
              class="text-title-medium font-medium"
              [class.text-primary]="!isOverBudget()"
              [class.text-error]="isOverBudget()"
            >
              {{ remaining() | number: '1.2-2' : 'fr-CH' }}
            </span>
          </div>
        </div>
      </mat-card-header>
      <mat-card-content>
        <div class="space-y-4">
          @if (isOverBudget()) {
            <div
              class="inline-flex items-center gap-2 px-3 py-1 bg-error-container text-on-error-container rounded-lg"
            >
              <mat-icon class="icon-filled">report</mat-icon>
              <span class="text-label-large">Tu es en hors budget !</span>
            </div>
          }
          <div class="space-y-2">
            <mat-progress-bar
              mode="determinate"
              [value]="budgetUsedPercentage()"
              [color]="isOverBudget() ? 'warn' : 'primary'"
            />
            <div class="text-label-small text-on-surface-variant">
              {{ displayPercentage() }}% du budget dépensé
            </div>
          </div>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    @use '@angular/material' as mat;

    :host {
      display: block;
      @include mat.progress-bar-overrides(
        (
          track-height: 10px,
          active-indicator-height: 10px,
        )
      );
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetProgressBar {
  /**
   * Total des dépenses (expenses + savings) SANS le rollover
   */
  expenses = input.required<number>();

  /**
   * Montant disponible total (revenus + rollover)
   * Peut être négatif si rollover négatif important
   */
  available = input.required<number>();

  /**
   * Montant restant (disponible - dépenses)
   * Peut être négatif en cas de dépassement
   */
  remaining = input.required<number>();

  /**
   * Détecte si le budget est dépassé
   * True si le montant restant < 0
   */
  isOverBudget = computed(() => {
    return this.remaining() < 0;
  });

  /**
   * Pourcentage utilisé pour la barre de progression visuelle
   * Plafonné à 100% pour l'affichage de la barre
   * Formule: Dépenses / Disponible * 100
   */
  budgetUsedPercentage = computed(() => {
    const available = this.available();
    const expenses = this.expenses();

    // Protection contre les cas limites
    if (!available || available <= 0) return 0;

    // Calcul du pourcentage dépensé
    const percentage = (expenses / available) * 100;

    // Plafonner à 100% pour la barre visuelle
    return Math.round(Math.min(Math.max(0, percentage), 100));
  });

  /**
   * Pourcentage réel pour l'affichage textuel
   * Peut dépasser 100% en cas de dépassement budget
   * Formule: Dépenses / Disponible * 100
   */
  displayPercentage = computed(() => {
    const available = this.available();
    const expenses = this.expenses();

    // Protection contre les cas limites
    if (!available || available <= 0) return 0;

    // Calcul du pourcentage dépensé
    const percentage = (expenses / available) * 100;

    // Retourner le pourcentage réel, même > 100%
    return Math.round(percentage);
  });
}
