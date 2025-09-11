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
import { MatTooltipModule } from '@angular/material/tooltip';

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
  imports: [
    MatCardModule,
    MatIconModule,
    DecimalPipe,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header class="mb-4">
        <div class="flex flex-col gap-3 w-full">
          <!-- Ligne principale: Dépenses sur Disponible -->
          <div class="flex justify-between items-baseline gap-2">
            <div class="flex flex-col" [class.text-error]="isOverBudget()">
              <span class="text-body-small md:text-body flex items-center gap-1"
                >Dépenses CHF
                @if (isOverBudget()) {
                  <mat-icon
                    matTooltip="Tu es en dépassement"
                    class="icon-filled"
                    >report</mat-icon
                  >
                }
              </span>
              <span
                class="text-headline-small md:text-headline-large"
                [class.text-error]="isOverBudget()"
              >
                {{ expenses() | number: '1.2-2' : 'de-CH' }}
              </span>
            </div>
            <div class="flex flex-col text-right text-outline">
              <span class="text-body-small md:text-body">Disponible CHF</span>
              <span class="text-headline-small md:text-headline-large">
                {{ available() | number: '1.2-2' : 'de-CH' }}
              </span>
            </div>
          </div>
        </div>
      </mat-card-header>
      <mat-card-content class="space-y-2">
        <div class="space-y-2">
          <mat-progress-bar
            mode="determinate"
            [value]="budgetUsedPercentage()"
            [class.over-budget]="isOverBudget()"
          />
          <div
            class="text-label-small text-on-surface-variant"
            [class.text-error!]="isOverBudget()"
          >
            @if (displayPercentage() === -1) {
              Budget totalement dépassé
            } @else {
              {{ displayPercentage() }}% du budget dépensé
            }
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

    .over-budget {
      @include mat.progress-bar-overrides(
        (
          active-indicator-color: var(--mat-sys-error),
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

    // Cas spéciaux : disponible <= 0
    if (available <= 0) {
      // Si on a des dépenses avec rien de disponible, on est à 100% minimum
      return expenses > 0 ? 100 : 0;
    }

    // Calcul du pourcentage dépensé
    const percentage = (expenses / available) * 100;

    // Plafonner à 100% pour la barre visuelle
    return Math.round(Math.min(Math.max(0, percentage), 100));
  });

  /**
   * Pourcentage réel pour l'affichage textuel
   * Peut dépasser 100% en cas de dépassement budget
   * Formule: Dépenses / Disponible * 100
   * Retourne -1 si disponible <= 0 et dépenses > 0 (cas spécial à gérer dans le template)
   */
  displayPercentage = computed(() => {
    const available = this.available();
    const expenses = this.expenses();

    // Cas spéciaux : disponible <= 0
    if (available <= 0) {
      // Si on a des dépenses avec rien de disponible, retourner -1 pour indiquer un cas spécial
      // Sinon 0 si pas de dépenses
      return expenses > 0 ? -1 : 0;
    }

    // Calcul du pourcentage dépensé
    const percentage = (expenses / available) * 100;

    // Retourner le pourcentage réel, même > 100%
    return Math.round(percentage);
  });
}
