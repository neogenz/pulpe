import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'pulpe-realized-balance-tooltip',
  imports: [MatIconModule, MatTooltipModule],
  template: `
    <mat-icon
      matTooltip="Ce solde est calculé en fonction des dépenses que vous avez cochées comme effectuées. Comparez-le à votre solde bancaire pour vérifier qu'il n'y a pas d'écart."
      matTooltipPosition="above"
      aria-label="Information sur le solde actuel"
      class="text-financial-income cursor-help text-base!"
      tabindex="0"
      >info</mat-icon
    >
  `,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RealizedBalanceTooltip {}
