import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import type { UpcomingMonthForecast } from '../services/dashboard-store';

@Component({
  selector: 'pulpe-dashboard-next-month',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col w-full h-full">
      <div class="mb-4 px-1 flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center flex-shrink-0"
        >
          <mat-icon>event_upcoming</mat-icon>
        </div>
        <div>
          <h2 class="text-title-medium font-bold text-on-surface leading-tight">
            Mois prochain
          </h2>
          <p
            class="text-body-small text-on-surface-variant font-medium mt-0.5 capitalize"
          >
            {{ monthName() }} {{ forecast().year }}
          </p>
        </div>
      </div>

      <div
        class="bg-surface-container-low rounded-3xl p-5 flex-1 flex flex-col justify-center"
      >
        @if (hasBudget()) {
          <p class="text-body-medium text-on-surface-variant text-center">
            Budget anticipé — report estimé :
            <span
              class="font-bold"
              [class]="
                estimatedRollover() >= 0
                  ? 'text-primary'
                  : 'text-on-surface-variant'
              "
            >
              {{ formattedRollover() }} CHF
            </span>
          </p>
        } @else {
          <div class="flex flex-col items-center justify-center gap-3 py-4">
            <mat-icon
              class="text-on-surface-variant opacity-40 !text-4xl !w-9 !h-9"
            >
              event_busy
            </mat-icon>
            <p class="text-body-medium text-on-surface-variant text-center">
              Pas encore de budget pour {{ monthName() }}
            </p>
            <button matButton="outlined" (click)="navigateToBudgets.emit()">
              <mat-icon>add</mat-icon>
              Anticiper le mois prochain
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class DashboardNextMonth {
  readonly forecast = input.required<UpcomingMonthForecast>();
  readonly estimatedRollover = input.required<number>();

  readonly navigateToBudgets = output<void>();

  protected readonly monthName = computed(() => {
    const f = this.forecast();
    return new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(
      new Date(f.year, f.month - 1, 1),
    );
  });

  protected readonly hasBudget = computed(() => this.forecast().hasBudget);

  protected readonly formattedRollover = computed(() =>
    new Intl.NumberFormat('de-CH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(this.estimatedRollover()),
  );
}
