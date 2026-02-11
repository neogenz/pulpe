import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'pulpe-realized-balance-tooltip',
  imports: [MatIconModule, MatTooltipModule],
  template: `
    <mat-icon
      matTooltip="Ce solde est calculé à partir des éléments cochés, report compris. Compare-le à ton solde bancaire pour vérifier que tout colle."
      matTooltipPosition="above"
      matTooltipTouchGestures="auto"
      matTooltipClass="text-center"
      aria-hidden="false"
      aria-label="Information sur le solde actuel"
      role="button"
      tabindex="0"
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
export class RealizedBalanceTooltip {}
