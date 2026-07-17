import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * PUL-292 — muted chip marking an income line as the "pris sur ton épargne"
 * half of a pioche (a Revenu drawn from savings, repaid the next month). Sibling
 * of `SpreadBadge`. The `savings` glyph + label read as a single unit.
 */
@Component({
  selector: 'pulpe-savings-withdrawal-badge',
  imports: [MatIconModule, TranslocoPipe],
  template: `
    <span
      class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 shrink-0
             bg-surface-container-high text-on-surface-variant text-label-small font-medium"
      [attr.aria-label]="'budget.savingsWithdrawal.badgeAria' | transloco"
    >
      <mat-icon class="text-sm! shrink-0 h-auto! w-auto!">savings</mat-icon>
      {{ 'budget.savingsWithdrawal.badgeLabel' | transloco }}
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavingsWithdrawalBadge {}
