import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * PUL-292 (CA1) — contextual nudge under the hero when the viewed month runs a
 * deficit: offers to "piocher dans son épargne". Presentational only — the
 * parent owns the visibility gate + dismissal persistence. Copy is contractual
 * (validated in test user): never "avance" nor "emprunt".
 */
@Component({
  selector: 'pulpe-savings-withdrawal-card',
  imports: [MatButtonModule, MatIconModule, TranslocoPipe],
  template: `
    <div
      class="flex flex-col gap-3 rounded-corner-large bg-primary-container/40 p-4"
      data-testid="savings-withdrawal-card"
    >
      <h3 class="text-title-small font-medium text-balance text-on-surface">
        {{ 'budget.savingsWithdrawal.cardTitle' | transloco }}
      </h3>

      <div class="flex flex-col text-body-medium text-on-surface-variant">
        <span>{{ 'budget.savingsWithdrawal.cardLine1' | transloco }}</span>
        <span>{{ 'budget.savingsWithdrawal.cardLine2' | transloco }}</span>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          matButton="tonal"
          (click)="withdraw.emit()"
          data-testid="savings-withdrawal-card-cta"
        >
          <mat-icon>savings</mat-icon>
          {{ 'budget.savingsWithdrawal.cta' | transloco }}
        </button>

        <button
          matButton
          (click)="dismiss.emit()"
          data-testid="savings-withdrawal-card-dismiss"
        >
          {{ 'budget.savingsWithdrawal.later' | transloco }}
        </button>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavingsWithdrawalCard {
  readonly withdraw = output<void>();
  readonly dismiss = output<void>();
}
