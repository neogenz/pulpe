import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { BudgetPeriodDates } from 'pulpe-shared';
import { BUDGET_WARNING_THRESHOLD_PERCENT } from '@core/budget';

@Component({
  selector: 'pulpe-dashboard-hero',
  imports: [MatIconModule, DecimalPipe, MatTooltipModule],
  template: `
    <div
      class="hero-container rounded-[32px] p-6 pb-5 relative overflow-hidden cursor-pointer motion-safe:transition-transform motion-safe:hover:scale-[0.99] dark:border dark:border-white/5"
      [class.budget-over]="isOverBudget()"
      [class.budget-warning]="isWarning()"
      (click)="heroClick.emit()"
      (keydown.enter)="heroClick.emit()"
      tabindex="0"
      role="button"
      [attr.aria-label]="
        'Disponible ' + remaining() + ' CHF — ' + periodLabel()
      "
    >
      <div
        class="absolute -right-10 -bottom-10 w-56 h-56 bg-white/15 rounded-full blur-3xl pointer-events-none"
      ></div>
      <div
        class="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none"
      ></div>
      <div
        class="absolute -left-8 top-1/2 w-24 h-24 bg-white/5 rounded-full blur-2xl pointer-events-none"
      ></div>

      <div class="flex justify-between items-start mb-6 relative z-10">
        <div>
          <div class="flex items-center gap-2 mb-2 opacity-90">
            <div
              class="w-2 h-2 rounded-full motion-safe:animate-pulse indicator-dot"
            ></div>
            <p class="text-label-medium font-bold uppercase tracking-wider">
              Mois en cours
            </p>
          </div>
          <h2
            class="font-bold text-headline-medium capitalize tracking-tight leading-none"
          >
            {{ periodLabel() }}
          </h2>
        </div>
        <div
          class="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md shadow-sm border border-white/10"
        >
          @switch (budgetStatus()) {
            @case ('on-track') {
              <mat-icon class="bolt-icon" aria-hidden="true">bolt</mat-icon>
            }
            @case ('warning') {
              <mat-icon class="bolt-icon" aria-hidden="true">warning</mat-icon>
            }
            @case ('over-budget') {
              <mat-icon class="bolt-icon" aria-hidden="true">error</mat-icon>
            }
          }
        </div>
      </div>

      <!-- Disponible section -->
      <div class="mb-8 relative z-10">
        <p
          class="text-label-medium font-bold uppercase tracking-wider opacity-80 mb-2"
        >
          Disponible
        </p>
        <div class="flex items-baseline gap-2">
          <span
            class="font-extrabold text-display-large tracking-tighter leading-none"
            data-testid="hero-remaining-amount"
          >
            {{ remaining() | number: '1.2-2' : 'de-CH' }}
          </span>
          <span class="text-title-large font-semibold opacity-70">CHF</span>
        </div>
        <p class="text-body-small opacity-60 mt-1">
          Revenus {{ totalIncome() | number: '1.2-2' : 'de-CH' }}
          @let rollover = rolloverAmount();
          @if (rollover !== 0) {
            <span class="opacity-80">
              Report
              {{ rollover > 0 ? '+' : ''
              }}{{ rollover | number: '1.2-2' : 'de-CH' }}
            </span>
          }
        </p>
      </div>

      <!-- Progress Bar -->
      <div
        class="space-y-2.5 relative z-10 bg-white/15 dark:bg-white/20 backdrop-blur-sm p-4 rounded-2xl border border-white/15 dark:border-white/20"
      >
        <div class="flex justify-between text-label-small font-bold">
          <span>
            Dépensé
            <span data-testid="hero-expenses-amount">{{
              absExpenses() | number: '1.2-2' : 'de-CH'
            }}</span>
            CHF
          </span>
          <span class="opacity-70">
            sur {{ available() | number: '1.2-2' : 'de-CH' }} CHF
          </span>
        </div>
        <div
          class="relative w-full h-3 bg-black/10 rounded-full overflow-hidden"
          [matTooltip]="'Mois écoulé : ' + timeElapsedPercentage() + '%'"
        >
          <div
            class="absolute -top-0.5 -bottom-0.5 w-1 z-10 rounded-full pace-marker motion-safe:transition-all motion-safe:duration-700"
            [style.left.%]="timeElapsedPercentage()"
          ></div>
          <div
            class="h-full rounded-full overflow-hidden motion-safe:transition-all motion-safe:duration-1000 relative progress-fill"
            [style.width.%]="budgetConsumedPercentage()"
          >
            <div
              class="absolute right-1 top-[3px] w-1.5 h-1.5 bg-white/60 rounded-full shadow-sm"
            ></div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .hero-container {
        background: linear-gradient(
          145deg,
          var(--pulpe-hero-primary) 0%,
          color-mix(in srgb, var(--pulpe-hero-primary) 75%, black) 100%
        );
        color: var(--pulpe-hero-primary-text);
        box-shadow: var(--mat-sys-level2);
      }

      .hero-container.budget-warning {
        background: linear-gradient(
          145deg,
          var(--pulpe-hero-warning) 0%,
          color-mix(in srgb, var(--pulpe-hero-warning) 75%, black) 100%
        );
        color: var(--pulpe-hero-warning-text);
      }

      .hero-container.budget-over {
        background: linear-gradient(
          145deg,
          var(--pulpe-hero-error) 0%,
          color-mix(in srgb, var(--pulpe-hero-error) 75%, black) 100%
        );
        color: var(--pulpe-hero-error-text);
      }

      .indicator-dot {
        background-color: currentColor;
      }

      .bolt-icon {
        color: currentColor;
      }

      .progress-fill {
        background-color: currentColor;
      }

      .pace-marker {
        background-color: currentColor;
        opacity: 0.7;
        box-shadow: 0 0 4px rgba(0, 0, 0, 0.4);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardHero {
  readonly expenses = input.required<number>();
  readonly available = input.required<number>();
  readonly periodDates = input.required<BudgetPeriodDates>();
  readonly totalIncome = input.required<number>();
  readonly rolloverAmount = input(0);
  readonly timeElapsedPercentage = input(0);
  readonly paceStatus = input<'on-track' | 'tight'>('on-track');

  readonly remaining = input.required<number>();
  readonly budgetConsumedPercentage = input.required<number>();

  readonly heroClick = output<void>();

  readonly absExpenses = computed(() => Math.abs(this.expenses()));

  readonly isOverBudget = computed(() => this.remaining() < 0);

  readonly isWarning = computed(
    () =>
      !this.isOverBudget() &&
      this.budgetConsumedPercentage() > BUDGET_WARNING_THRESHOLD_PERCENT,
  );
  readonly budgetStatus = computed<'on-track' | 'warning' | 'over-budget'>(
    () => {
      if (this.isOverBudget()) return 'over-budget';
      if (this.isWarning()) return 'warning';
      return 'on-track';
    },
  );

  readonly periodLabel = computed(() => {
    const dates = this.periodDates();
    if (!dates) return '';
    const start = dates.startDate.getTime();
    const end = dates.endDate.getTime();
    const middleDate = new Date(start + (end - start) / 2);
    return new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(
      middleDate,
    );
  });
}
