import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';

import { MatRipple } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { FinancialKindDirective } from '@ui/financial-kind';
import type { BudgetLineConsumption } from '@core/budget';
import type { BudgetLine, SupportedCurrency } from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';

const MAX_VISIBLE_FORECASTS = 5;
const EXIT_ANIMATION_NAME = 'forecast-check-exit';
const EXIT_ANIMATION_MS = 500;
const EXIT_TIMEOUT_BUFFER_MS = 100;

interface AnimatingForecast {
  forecast: BudgetLine;
  originalIndex: number;
}

@Component({
  selector: 'pulpe-dashboard-unchecked-forecasts',
  imports: [
    MatButtonModule,
    MatRipple,
    MatIconModule,
    AppCurrencyPipe,
    FinancialKindDirective,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col w-full h-full">
      <div class="mb-4 px-1 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0"
          >
            <mat-icon aria-hidden="true">checklist</mat-icon>
          </div>
          <div>
            <h2
              class="text-title-medium font-bold text-on-surface leading-tight"
            >
              {{ 'currentMonth.uncheckedForecasts.title' | transloco }}
            </h2>
            <p
              class="text-body-small text-on-surface-variant font-medium mt-0.5"
            >
              {{
                'currentMonth.uncheckedForecasts.count'
                  | transloco: { count: forecasts().length }
              }}
            </p>
          </div>
        </div>
        @if (hasMore()) {
          <button matButton (click)="viewBudget.emit()">
            {{ 'common.viewAll' | transloco }}
          </button>
        }
      </div>

      <div class="bg-surface-container-low rounded-3xl py-3 px-3 flex-1">
        @if (displayedForecasts().length > 0) {
          <div class="flex flex-col gap-1">
            @for (forecast of displayedForecasts(); track forecast.id) {
              @let displayAmount =
                consumptions().get(forecast.id)?.remaining ?? forecast.amount;
              @let isChecking = isExitAnimating(forecast.id);
              <div
                class="relative overflow-hidden flex items-center gap-3 p-3 rounded-2xl hover:bg-on-surface/8 motion-safe:transition-colors"
                [class.checking]="isChecking"
                (animationend)="onExitAnimationEnd(forecast.id, $event)"
                data-testid="dashboard-forecasts-row"
              >
                <button
                  class="shrink-0 flex items-center justify-center w-11 h-11 -m-2 rounded-full cursor-pointer"
                  matRipple
                  [matRippleCentered]="true"
                  (click)="toggleForecast(forecast.id)"
                  [attr.aria-label]="
                    'currentMonth.uncheckedForecasts.toggleAriaLabel'
                      | transloco
                        : { name: forecast.name, amount: displayAmount }
                  "
                  data-testid="dashboard-forecasts-toggle"
                >
                  <mat-icon
                    [class.text-primary]="isChecking"
                    [class.icon-filled]="isChecking"
                    aria-hidden="true"
                  >
                    {{ isChecking ? 'check_circle' : 'radio_button_unchecked' }}
                  </mat-icon>
                </button>
                <span
                  class="text-body-medium font-bold text-on-surface truncate flex-1 min-w-0 ph-no-capture"
                  data-testid="dashboard-forecasts-name"
                >
                  {{ forecast.name }}
                </span>
                <span
                  class="text-label-large whitespace-nowrap font-semibold tabular-nums ph-no-capture"
                  [pulpeFinancialKind]="forecast.kind"
                  data-testid="dashboard-forecasts-amount"
                >
                  {{ displayAmount | appCurrency: currency() : '1.0-0' }}
                </span>
              </div>
            }
          </div>
        } @else {
          <div
            class="p-8 flex flex-col items-center justify-center text-center h-full"
            data-testid="dashboard-forecasts-empty-state"
          >
            <div
              class="w-16 h-16 rounded-full bg-financial-income/10 text-financial-income flex items-center justify-center mb-4"
            >
              <mat-icon class="scale-150" aria-hidden="true">done_all</mat-icon>
            </div>
            <h3 class="text-title-medium font-medium text-on-surface-variant">
              {{ 'dashboard.allUpToDate' | transloco }}
            </h3>
            <p class="text-body-medium text-on-surface-variant">
              {{
                'currentMonth.uncheckedForecasts.allCheckedMessage' | transloco
              }}
            </p>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    @keyframes forecast-check-exit {
      0%,
      30% {
        opacity: 1;
        transform: translateX(0);
      }
      100% {
        opacity: 0;
        transform: translateX(1rem);
      }
    }

    .checking {
      animation: forecast-check-exit 500ms var(--pulpe-ease-emphasized) forwards;
      pointer-events: none;
    }

    @media (prefers-reduced-motion: reduce) {
      .checking {
        animation: forecast-check-exit 1ms forwards;
        opacity: 0.5;
      }
    }
  `,
})
export class DashboardUncheckedForecasts {
  readonly forecasts = input.required<BudgetLine[]>();
  readonly consumptions = input(new Map<string, BudgetLineConsumption>());
  readonly currency = input<SupportedCurrency>('CHF');
  readonly toggleCheck = output<string>();
  readonly viewBudget = output<void>();

  readonly #destroyRef = inject(DestroyRef);

  // linkedSignal: writable derived state. Computation runs on `forecasts()`
  // change and strips entries whose id has reappeared (rollback). Manual
  // updates (toggle / animation end) persist between source changes.
  readonly #animatingOut = linkedSignal<
    BudgetLine[],
    Map<string, AnimatingForecast>
  >({
    source: this.forecasts,
    computation: (forecasts, prev) => {
      const current = prev?.value ?? new Map<string, AnimatingForecast>();
      if (current.size === 0) return current;
      const visibleIds = new Set(forecasts.map((f) => f.id));
      let stripped: Map<string, AnimatingForecast> | null = null;
      for (const id of current.keys()) {
        if (visibleIds.has(id)) {
          stripped ??= new Map(current);
          stripped.delete(id);
        }
      }
      return stripped ?? current;
    },
  });

  // Per-id safety timer: ensures ghosts always clean up even when
  // `animationend` doesn't fire (iOS Safari edge cases, ghost sliced out
  // of MAX_VISIBLE_FORECASTS, element re-mounted mid-animation, etc.).
  readonly #ghostTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    this.#destroyRef.onDestroy(() => {
      for (const timer of this.#ghostTimers.values()) clearTimeout(timer);
      this.#ghostTimers.clear();
    });
  }

  protected readonly hasMore = computed(
    () => this.forecasts().length > MAX_VISIBLE_FORECASTS,
  );

  protected readonly displayedForecasts = computed(() => {
    const list = this.forecasts();
    const animating = this.#animatingOut();
    const visibleList = list.slice(0, MAX_VISIBLE_FORECASTS);

    if (animating.size === 0) return visibleList;

    const visibleIds = new Set(visibleList.map((f) => f.id));
    const ghosts = [...animating.values()]
      .filter(({ forecast }) => !visibleIds.has(forecast.id))
      .toSorted((a, b) => a.originalIndex - b.originalIndex);

    const merged: BudgetLine[] = [...visibleList];
    for (const { forecast, originalIndex } of ghosts) {
      merged.splice(Math.min(originalIndex, merged.length), 0, forecast);
    }
    return merged.slice(0, MAX_VISIBLE_FORECASTS);
  });

  protected isExitAnimating(forecastId: string): boolean {
    return this.#animatingOut().has(forecastId);
  }

  protected toggleForecast(forecastId: string): void {
    const list = this.forecasts();
    const originalIndex = list.findIndex((f) => f.id === forecastId);
    const forecast = list[originalIndex];
    if (!forecast) return;

    this.#animatingOut.update((current) => {
      const next = new Map(current);
      next.set(forecastId, { forecast, originalIndex });
      return next;
    });
    this.#scheduleGhostCleanup(forecastId);
    this.toggleCheck.emit(forecastId);
  }

  protected onExitAnimationEnd(
    forecastId: string,
    event: AnimationEvent,
  ): void {
    if (event.target !== event.currentTarget) return;
    if (event.animationName !== EXIT_ANIMATION_NAME) return;
    this.#removeGhost(forecastId);
  }

  #scheduleGhostCleanup(forecastId: string): void {
    this.#clearGhostTimer(forecastId);
    const timer = setTimeout(
      () => this.#removeGhost(forecastId),
      EXIT_ANIMATION_MS + EXIT_TIMEOUT_BUFFER_MS,
    );
    this.#ghostTimers.set(forecastId, timer);
  }

  #clearGhostTimer(forecastId: string): void {
    const timer = this.#ghostTimers.get(forecastId);
    if (timer === undefined) return;
    clearTimeout(timer);
    this.#ghostTimers.delete(forecastId);
  }

  #removeGhost(forecastId: string): void {
    this.#clearGhostTimer(forecastId);
    this.#animatingOut.update((current) => {
      if (!current.has(forecastId)) return current;
      const next = new Map(current);
      next.delete(forecastId);
      return next;
    });
  }
}
