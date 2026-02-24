import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

type InsightType = 'surplus' | 'balanced' | 'slight-deficit' | 'deficit';

const INSIGHT_ICONS: Record<InsightType, string> = {
  surplus: 'check_circle',
  balanced: 'thumb_up',
  'slight-deficit': 'info',
  deficit: 'support',
};

const INSIGHT_MESSAGES: Record<InsightType, string | null> = {
  surplus: null,
  balanced: 'Pile poil dans le budget. Bien joué.',
  'slight-deficit':
    'Ce mois sera un peu serré. Le déficit sera reporté le mois prochain.',
  deficit: "Mois compliqué — mais tu as la visibilité, et c'est ce qui compte.",
};

const MONTH_END_VISIBILITY_THRESHOLD = 90;
const SURPLUS_THRESHOLD = 100;
const BALANCED_THRESHOLD = -50;
const SLIGHT_DEFICIT_THRESHOLD = -500;

const AMOUNT_FORMATTER = new Intl.NumberFormat('de-CH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

@Component({
  selector: 'pulpe-dashboard-month-insight',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isVisible()) {
      <div
        class="bg-surface-container-low rounded-2xl p-4 flex items-start gap-3 border border-outline-variant/30 animate-fade-in"
      >
        <mat-icon class="text-primary mt-0.5 flex-shrink-0">
          {{ icon() }}
        </mat-icon>
        @if (insightType() === 'surplus') {
          <p class="text-body-medium text-on-surface-variant leading-relaxed">
            Ce mois se termine bien — il te reste
            <span class="text-financial-savings font-bold tabular-nums"
              >{{ surplusAmount() }} CHF</span
            >
            qui seront reportés.
          </p>
        } @else {
          <p class="text-body-medium text-on-surface-variant leading-relaxed">
            {{ message() }}
          </p>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    @keyframes fade-in {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .animate-fade-in {
      animation: fade-in 300ms ease-out;
    }
  `,
})
export class DashboardMonthInsight {
  readonly timeElapsedPercentage = input.required<number>();
  readonly remaining = input.required<number>();

  protected readonly isVisible = computed(
    () => this.timeElapsedPercentage() > MONTH_END_VISIBILITY_THRESHOLD,
  );

  protected readonly insightType = computed<InsightType>(() => {
    const remaining = this.remaining();
    if (remaining > SURPLUS_THRESHOLD) return 'surplus';
    if (remaining >= BALANCED_THRESHOLD) return 'balanced';
    if (remaining >= SLIGHT_DEFICIT_THRESHOLD) return 'slight-deficit';
    return 'deficit';
  });

  protected readonly surplusAmount = computed(() =>
    AMOUNT_FORMATTER.format(Math.abs(this.remaining())),
  );

  protected readonly message = computed(() => {
    const type = this.insightType();
    if (type === 'surplus') return null;
    return INSIGHT_MESSAGES[type];
  });

  protected readonly icon = computed(() => INSIGHT_ICONS[this.insightType()]);
}
