import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * PUL-329 — d'où vient l'argent d'un revenu financé par un objectif d'épargne.
 *
 * Deux états, jamais un troisième : le lien est ACTIF (identifiant + nom) ou
 * CASSÉ (nom seul, l'objectif a été supprimé). Le lien cassé reste neutre —
 * aucune couleur d'erreur, aucun chevron : ce n'est pas une anomalie, c'est de
 * l'histoire. La navigation appartient à l'appelant : les listes compactes
 * affichent l'origine, seul le détail la rend cliquable.
 *
 * Ne pas confondre avec `SavingsWithdrawalBadge` (PUL-292), qui marque une
 * pioche remboursée le mois suivant.
 */
@Component({
  selector: 'pulpe-savings-goal-source-line',
  imports: [MatIconModule, MatTooltipModule, TranslocoPipe],
  template: `
    @if (goalName(); as name) {
      <span
        class="inline-flex items-center gap-1 min-w-0 text-on-surface-variant"
        [class.truncate]="variant() === 'compact'"
        [matTooltip]="
          isBroken()
            ? ('budget.savingsGoalSource.brokenTooltip' | transloco)
            : ''
        "
        [attr.aria-label]="
          (isBroken()
            ? 'budget.savingsGoalSource.brokenAria'
            : 'budget.savingsGoalSource.activeAria'
          ) | transloco: { name: name }
        "
        data-testid="savings-goal-source-line"
      >
        <mat-icon class="text-sm! shrink-0 h-auto! w-auto!">{{
          isBroken() ? 'link_off' : 'savings'
        }}</mat-icon>
        <span aria-hidden="true" [class.truncate]="variant() === 'compact'">
          {{
            (isBroken()
              ? 'budget.savingsGoalSource.brokenLabel'
              : 'budget.savingsGoalSource.activeLabel'
            ) | transloco
          }}
          · <span class="ph-no-capture">{{ name }}</span>
        </span>
      </span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      min-width: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavingsGoalSourceLine {
  readonly goalId = input<string | null | undefined>(null);
  readonly goalName = input<string | null | undefined>(null);
  readonly variant = input<'compact' | 'detail'>('compact');

  protected readonly isBroken = computed(() => !this.goalId());
}
