import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'pulpe-verification-tooltip',
  imports: [MatIconModule, MatTooltipModule],
  template: `
    <mat-icon
      matTooltip="Au fur et à mesure que tu pointes tes éléments, ce montant te dit combien il devrait rester sur ton compte. Compare avec ton app bancaire !"
      matTooltipPosition="above"
      matTooltipTouchGestures="auto"
      matTooltipClass="text-center"
      aria-hidden="false"
      aria-label="Information sur le solde estimé"
      class="text-financial-income cursor-help text-base! text-center"
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
export class VerificationTooltip {}
