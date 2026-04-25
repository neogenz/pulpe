import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import type { SupportedCurrency } from 'pulpe-shared';
import { FinancialPills } from '../financial-pills/financial-pills';

export interface FinancialTotals {
  income: number;
  expenses: number;
  savings: number;
  remaining: number;
}

@Component({
  selector: 'pulpe-budget-financial-overview',
  imports: [DecimalPipe, FinancialPills],
  template: `
    <div class="space-y-6">
      <div
        class="text-center py-8 px-6 rounded-3xl"
        [class.bg-primary-container]="budgetState() === 'comfortable'"
        [class.hero-warning]="budgetState() === 'warning'"
        [class.bg-error-container]="budgetState() === 'deficit'"
      >
        <p
          class="text-body-large mb-3"
          [class.text-on-primary-container]="budgetState() === 'comfortable'"
          [class.text-warning-on-container]="budgetState() === 'warning'"
          [class.text-on-error-container]="budgetState() === 'deficit'"
        >
          @switch (budgetState()) {
            @case ('comfortable') {
              Ce qu'il te reste ce mois
              <span
                class="text-body-small text-on-primary-container/70 block mt-0.5"
                >selon tes prévisions</span
              >
            }
            @case ('warning') {
              Ce qu'il te reste ce mois
              <span class="text-body-small text-warning/70 block mt-0.5"
                >selon tes prévisions</span
              >
            }
            @case ('deficit') {
              Déficit ce mois
              <span
                class="text-body-small text-on-error-container/70 block mt-0.5"
                >selon tes prévisions</span
              >
            }
          }
        </p>
        <div
          class="text-display-medium sm:text-display-large font-bold tracking-tight ph-no-capture"
          [class.text-on-primary-container]="budgetState() === 'comfortable'"
          [class.text-warning]="budgetState() === 'warning'"
          [class.text-on-error-container]="budgetState() === 'deficit'"
        >
          {{ remainingAbsolute() | number: '1.0-0' : locale() }}
          <span class="text-headline-small font-normal">{{ currency() }}</span>
        </div>
        <p
          class="text-body-medium mt-3"
          [class.text-on-primary-container]="budgetState() === 'comfortable'"
          [class.text-warning-on-container]="budgetState() === 'warning'"
          [class.text-on-error-container]="budgetState() === 'deficit'"
        >
          @switch (budgetState()) {
            @case ('comfortable') {
              Belle marge ce mois
            }
            @case ('warning') {
              @if (totals().remaining > 0) {
                Tu gères bien
              } @else {
                Pile à l'équilibre
              }
            }
            @case ('deficit') {
              Ce mois sera serré — mais tu le sais
            }
          }
        </p>
      </div>

      <pulpe-financial-pills
        [totals]="{
          income: totals().income,
          expenses: totals().expenses,
          savings: totals().savings,
        }"
        [currency]="currency()"
        [locale]="locale()"
      />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .hero-warning {
      background-color: var(--pulpe-amber-container);
    }

    .text-warning {
      color: var(--pulpe-amber);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetFinancialOverview {
  readonly totals = input.required<FinancialTotals>();
  readonly currency = input<SupportedCurrency>('CHF');
  readonly locale = input<string>('de-CH');
  readonly warningThreshold = input(90);

  readonly isPositive = computed(() => this.totals().remaining >= 0);

  readonly isComfortable = computed(() => {
    const { remaining, income } = this.totals();
    if (income <= 0) return remaining >= 0;
    const consumedPercent = ((income - remaining) / income) * 100;
    return consumedPercent <= this.warningThreshold();
  });

  readonly budgetState = computed<'comfortable' | 'warning' | 'deficit'>(() => {
    if (!this.isPositive()) return 'deficit';
    if (!this.isComfortable()) return 'warning';
    return 'comfortable';
  });

  readonly remainingAbsolute = computed(() =>
    Math.abs(this.totals().remaining),
  );
}
