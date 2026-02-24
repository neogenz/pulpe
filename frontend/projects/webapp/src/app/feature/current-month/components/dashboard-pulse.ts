import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';

type Indicator = 'good' | 'warning' | 'neutral';

@Component({
  selector: 'pulpe-dashboard-pulse',
  standalone: true,
  imports: [MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-1.5">
        <div
          class="w-2 h-2 rounded-full transition-colors"
          [class]="dotClass(paceIndicator())"
          [matTooltip]="paceTooltip()"
        ></div>
        <div
          class="w-2 h-2 rounded-full transition-colors"
          [class]="dotClass(coverageIndicator())"
          [matTooltip]="coverageTooltip()"
        ></div>
        <div
          class="w-2 h-2 rounded-full transition-colors"
          [class]="dotClass(planningIndicator())"
          [matTooltip]="planningTooltip()"
        ></div>
      </div>
      <span class="text-label-small text-on-surface-variant opacity-60">
        Pouls budget
      </span>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class DashboardPulse {
  readonly budgetConsumedPercentage = input.required<number>();
  readonly timeElapsedPercentage = input.required<number>();
  readonly checkedForecastCount = input.required<number>();
  readonly totalForecastCount = input.required<number>();
  readonly nextMonthHasBudget = input.required<boolean>();

  protected readonly paceIndicator = computed<Indicator>(() => {
    const consumed = this.budgetConsumedPercentage();
    const elapsed = this.timeElapsedPercentage();
    return consumed <= elapsed + 5 ? 'good' : 'warning';
  });

  protected readonly coverageIndicator = computed<Indicator>(() => {
    const total = this.totalForecastCount();
    if (total === 0) return 'neutral';
    const ratio = this.checkedForecastCount() / total;
    return ratio >= 0.7 ? 'good' : 'warning';
  });

  protected readonly planningIndicator = computed<Indicator>(() =>
    this.nextMonthHasBudget() ? 'good' : 'neutral',
  );

  protected readonly paceTooltip = computed(() =>
    this.paceIndicator() === 'good'
      ? 'Rythme : en avance'
      : 'Rythme : un peu serré',
  );

  protected readonly coverageTooltip = computed(
    () =>
      `Suivi : ${this.checkedForecastCount()}/${this.totalForecastCount()} prévisions cochées`,
  );

  protected readonly planningTooltip = computed(() =>
    this.nextMonthHasBudget()
      ? 'Prochain mois : anticipé'
      : 'Prochain mois : pas encore de budget',
  );

  protected dotClass(indicator: Indicator): string {
    switch (indicator) {
      case 'good':
        return 'bg-primary';
      case 'warning':
        return 'bg-amber-500';
      case 'neutral':
        return 'bg-outline-variant';
    }
  }
}
