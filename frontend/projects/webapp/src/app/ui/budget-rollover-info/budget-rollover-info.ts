import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CURRENCY_METADATA, type SupportedCurrency } from 'pulpe-shared';

@Component({
  selector: 'pulpe-budget-rollover-info',
  imports: [DecimalPipe, MatIconModule, TranslocoPipe],
  template: `
    @if (shouldDisplay()) {
      <div
        class="flex items-center gap-2 px-1 text-body-small text-on-surface-variant"
        role="status"
        [attr.aria-label]="ariaLabel()"
      >
        <mat-icon
          class="mat-icon-sm"
          [class.text-primary]="isPositive()"
          [class.text-warning]="!isPositive()"
          aria-hidden="true"
        >
          {{ isPositive() ? 'trending_up' : 'trending_down' }}
        </mat-icon>
        <span>{{ 'budget.rolloverInfo.label' | transloco }}</span>
        <span
          class="font-medium ph-no-capture"
          [class.text-primary]="isPositive()"
          [class.text-warning]="!isPositive()"
        >
          {{ isPositive() ? '+' : '−'
          }}{{ absoluteAmount() | number: '1.0-0' : locale() }}
          <span>{{ currencySymbol() }}</span>
        </span>
      </div>
    }
  `,
  styles: ':host { display: block; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetRolloverInfo {
  readonly #transloco = inject(TranslocoService);

  readonly rollover = input.required<number>();
  readonly rolloverSourceBudgetId = input.required<string | null>();
  readonly currency = input<SupportedCurrency>('CHF');
  readonly locale = input<string>('de-CH');

  protected readonly shouldDisplay = computed(
    () => this.rollover() !== 0 && this.rolloverSourceBudgetId() !== null,
  );

  protected readonly isPositive = computed(() => this.rollover() > 0);

  protected readonly currencySymbol = computed(
    () => CURRENCY_METADATA[this.currency()].symbol,
  );

  protected readonly absoluteAmount = computed(() => Math.abs(this.rollover()));

  protected readonly ariaLabel = computed(() => {
    const key = this.isPositive()
      ? 'budget.rolloverInfo.ariaSurplus'
      : 'budget.rolloverInfo.ariaDeficit';
    return this.#transloco.translate(key, {
      amount: this.absoluteAmount().toLocaleString(this.locale()),
      currency: this.currency(),
    });
  });
}
