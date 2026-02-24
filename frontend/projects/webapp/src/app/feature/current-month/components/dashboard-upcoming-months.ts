import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import type { UpcomingMonthForecast } from '../services/dashboard-store';

@Component({
  selector: 'pulpe-dashboard-upcoming-months',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col w-full h-full">
      <div class="mb-4 px-1 flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-full bg-secondary/10 text-secondary flex items-center justify-center flex-shrink-0"
        >
          <mat-icon>date_range</mat-icon>
        </div>
        <div>
          <h2 class="text-title-medium font-bold text-on-surface leading-tight">
            À venir
          </h2>
          <p class="text-body-small text-on-surface-variant font-medium mt-0.5">
            Prochains mois ({{ budgetCount() }}/{{ forecasts().length }}
            anticipés)
          </p>
        </div>
      </div>

      <div class="bg-surface-container-low rounded-3xl py-3 px-3 flex-1">
        <div class="relative">
          <div
            class="flex flex-col gap-1.5 scroll-list max-h-[320px] overflow-y-auto"
          >
            @for (
              forecast of forecasts();
              track forecast.month + '-' + forecast.year
            ) {
              @if (forecast.hasBudget) {
                <div
                  class="flex items-center justify-between p-3 rounded-2xl hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  <div class="flex items-center gap-3">
                    <div
                      class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant flex-shrink-0"
                    >
                      <mat-icon class="text-[20px]">calendar_today</mat-icon>
                    </div>
                    <div>
                      <h3
                        class="font-bold text-body-medium text-on-surface capitalize"
                      >
                        {{ getMonthName(forecast.month) }} {{ forecast.year }}
                      </h3>
                      <p
                        class="text-body-small text-on-surface-variant font-medium"
                      >
                        Prévision :
                        <span class="font-semibold text-on-surface">
                          {{ forecast.income | number: '1.2-2' : 'de-CH' }}
                          CHF
                        </span>
                      </p>
                    </div>
                  </div>
                  <mat-icon class="text-on-surface-variant opacity-40">
                    chevron_right
                  </mat-icon>
                </div>
              } @else {
                <div
                  class="flex items-center gap-3 p-3 rounded-2xl border border-dashed border-outline-variant"
                >
                  <div
                    class="w-10 h-10 rounded-full bg-outline-variant/20 flex items-center justify-center text-on-surface-variant/60 flex-shrink-0"
                  >
                    <mat-icon class="text-[20px]">event_busy</mat-icon>
                  </div>
                  <div class="flex-1 min-w-0">
                    <h3
                      class="font-bold text-body-medium text-on-surface capitalize"
                    >
                      {{ getMonthName(forecast.month) }} {{ forecast.year }}
                    </h3>
                    <p class="text-body-small text-on-surface-variant">
                      Pas encore anticipé
                    </p>
                  </div>
                </div>
              }
            }
          </div>
          <div class="scroll-fade"></div>
          <div class="scroll-hint">
            <mat-icon class="text-[16px]">keyboard_arrow_down</mat-icon>
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

      .scroll-list {
        scrollbar-width: thin;
        scrollbar-color: transparent transparent;
      }

      .scroll-list:hover,
      .scroll-list:active {
        scrollbar-color: var(--mat-sys-outline-variant) transparent;
      }

      .scroll-list::-webkit-scrollbar {
        width: 4px;
      }

      .scroll-list::-webkit-scrollbar-thumb {
        background: transparent;
        border-radius: 4px;
      }

      .scroll-list:hover::-webkit-scrollbar-thumb,
      .scroll-list:active::-webkit-scrollbar-thumb {
        background: var(--mat-sys-outline-variant);
      }

      .scroll-fade {
        position: absolute;
        bottom: 28px;
        left: 0;
        right: 0;
        height: 48px;
        background: linear-gradient(
          to bottom,
          transparent 0%,
          var(--mat-sys-surface-container-low) 100%
        );
        pointer-events: none;
        z-index: 1;
      }

      .scroll-hint {
        display: flex;
        justify-content: center;
        padding: 4px 0 2px;
        color: var(--mat-sys-on-surface-variant);
        opacity: 0.5;
        animation: bounce-down 1.5s ease-in-out infinite;
        pointer-events: none;
      }

      @keyframes bounce-down {
        0%,
        100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(4px);
        }
      }
    `,
  ],
})
export class DashboardUpcomingMonths {
  readonly forecasts = input.required<UpcomingMonthForecast[]>();

  readonly budgetCount = computed(
    () => this.forecasts().filter((f) => f.hasBudget).length,
  );

  getMonthName(monthNumber: number): string {
    const date = new Date(2000, monthNumber - 1, 1);
    return new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(date);
  }
}
