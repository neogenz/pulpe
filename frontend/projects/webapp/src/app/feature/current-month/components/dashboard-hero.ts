import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { BudgetPeriodDates } from 'pulpe-shared';

@Component({
  selector: 'pulpe-dashboard-hero',
  standalone: true,
  imports: [CommonModule, MatIconModule, DecimalPipe, MatTooltipModule],
  template: `
    <div
      class="hero-container rounded-[32px] p-6 pb-5 shadow-premium relative overflow-hidden cursor-pointer transition-transform hover:scale-[0.99]"
      [class.budget-over]="isOverBudget()"
      [class.budget-warning]="isWarning()"
      (click)="heroClick.emit()"
      (keydown.enter)="heroClick.emit()"
      tabindex="0"
      role="button"
    >
      <!-- Background Accent Gradients -->
      <div
        class="absolute -right-10 -bottom-10 w-56 h-56 bg-white/15 rounded-full blur-3xl pointer-events-none"
      ></div>
      <div
        class="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none"
      ></div>
      <div
        class="absolute -left-8 top-1/2 w-24 h-24 bg-white/5 rounded-full blur-2xl pointer-events-none"
      ></div>

      <!-- Top row -->
      <div class="flex justify-between items-start mb-6 relative z-10">
        <div>
          <div class="flex items-center gap-2 mb-2 opacity-90">
            <div class="w-2 h-2 rounded-full animate-pulse indicator-dot"></div>
            <p class="text-label-medium font-bold uppercase tracking-wider">
              Mois en cours
            </p>
          </div>
          <h2
            class="font-bold text-headline-medium capitalize tracking-tight leading-none"
          >
            {{ formatPeriod() }}
          </h2>
        </div>
        <div
          class="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md shadow-sm border border-white/10"
        >
          @if (isOnTrack()) {
            <mat-icon class="bolt-icon">bolt</mat-icon>
          }
          @if (isWarning()) {
            <mat-icon class="bolt-icon">warning</mat-icon>
          }
          @if (isOverBudget()) {
            <mat-icon class="bolt-icon">error</mat-icon>
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
          @if (rolloverAmount() !== 0) {
            <span class="opacity-80">
              {{ rolloverAmount() > 0 ? '+' : '-' }} Report
              {{ Math.abs(rolloverAmount()) | number: '1.2-2' : 'de-CH' }}
            </span>
          }
        </p>
      </div>

      <!-- Progress Bar -->
      <div
        class="space-y-2.5 relative z-10 bg-white/15 backdrop-blur-sm p-4 rounded-2xl border border-white/15"
      >
        <div class="flex justify-between text-label-small font-bold">
          <span>
            Dépensé
            {{ Math.abs(expenses()) | number: '1.2-2' : 'de-CH' }} CHF
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
            class="absolute top-0 h-full w-0.5 z-10 rounded-full transition-all duration-700"
            [class]="
              paceStatus() === 'on-track'
                ? 'bg-green-400/70'
                : 'bg-amber-400/70'
            "
            [style.left.%]="timeElapsedPercentage()"
          ></div>
          <div
            class="h-full rounded-full transition-all duration-1000 relative progress-fill"
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
          var(--mat-sys-primary) 0%,
          color-mix(in srgb, var(--mat-sys-primary) 75%, black) 100%
        );
        color: var(--mat-sys-on-primary);
        box-shadow:
          0 8px 30px rgba(0, 0, 0, 0.08),
          0 4px 10px rgba(0, 0, 0, 0.02);
      }

      .hero-container.budget-warning {
        background: linear-gradient(145deg, #fef9c3, #fbbf24 55%, #d97706);
        color: #451a03;
      }

      .hero-container.budget-over {
        background: linear-gradient(
          145deg,
          var(--mat-sys-error-container) 0%,
          var(--mat-sys-error) 60%,
          color-mix(in srgb, var(--mat-sys-error) 85%, black) 100%
        );
        color: var(--mat-sys-on-error);
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

      .shadow-premium {
        box-shadow:
          0 8px 30px rgba(0, 0, 0, 0.04),
          0 4px 10px rgba(0, 0, 0, 0.01);
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

  readonly heroClick = output<void>();

  readonly Math = Math;

  readonly remaining = computed(() => this.available() - this.expenses());

  readonly isOverBudget = computed(() => this.remaining() < 0);

  readonly budgetConsumedPercentage = computed(() => {
    const available = this.available();
    const expenses = this.expenses();

    if (available <= 0) {
      return expenses > 0 ? 100 : 0;
    }

    const percentage = (expenses / available) * 100;
    return Math.round(Math.min(Math.max(0, percentage), 100));
  });

  readonly isWarning = computed(
    () => !this.isOverBudget() && this.budgetConsumedPercentage() > 80,
  );
  readonly isOnTrack = computed(
    () => !this.isOverBudget() && !this.isWarning(),
  );

  formatPeriod(): string {
    const dates = this.periodDates();
    if (!dates) return '';
    // Use the middle of the period to determine the month
    const start = dates.startDate.getTime();
    const end = dates.endDate.getTime();
    const middleDate = new Date(start + (end - start) / 2);

    return new Intl.DateTimeFormat('fr-FR', {
      month: 'long',
    }).format(middleDate);
  }
}
