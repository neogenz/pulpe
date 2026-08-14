import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { type SavingsGoal, type SavingsGoalStatus } from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';
import { getDateDisplayFormats } from '@core/date/date-display-formats';
import { ROUTES } from '@core/routing';
import { UserSettingsStore } from '@core/user-settings';

@Component({
  selector: 'pulpe-savings-goal-card',
  imports: [
    DatePipe,
    NgClass,
    MatCardModule,
    MatIconModule,
    RouterLink,
    TranslocoPipe,
    AppCurrencyPipe,
  ],
  template: `
    <a
      [routerLink]="['/', routes.SAVINGS_GOALS, goal().id]"
      class="savings-goal-link block h-full ph-no-capture amounts-visible"
      [attr.data-testid]="'savings-goal-' + goal().id"
    >
      <mat-card
        appearance="outlined"
        class="savings-goal-card h-full cursor-pointer"
        [class.savings-goal-card--completed]="isCompleted()"
      >
        <mat-card-content class="flex min-h-48 flex-col p-5!">
          <div class="flex items-start justify-between gap-3">
            <div
              class="flex size-11 shrink-0 items-center justify-center rounded-corner-medium bg-financial-savings/10 text-financial-savings"
            >
              <mat-icon aria-hidden="true">savings</mat-icon>
            </div>
            @if (!isActive()) {
              <span
                class="shrink-0 rounded-full px-2.5 py-1 text-label-small font-medium"
                [ngClass]="
                  isCompleted()
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface-variant'
                "
                data-testid="savings-goal-status"
              >
                {{ statusLabelKey() | transloco }}
              </span>
            }
          </div>

          <div class="mt-4 min-w-0">
            <h2
              class="ph-no-capture line-clamp-2 text-title-medium font-semibold text-on-surface"
            >
              {{ goal().name }}
            </h2>
          </div>

          @if (
            goal().targetAmount !== null ||
            goal().startDate ||
            goal().targetDate
          ) {
            <dl class="mt-5">
              @if (goal().targetAmount !== null) {
                <div>
                  <dt class="text-label-small text-on-surface-variant">
                    {{ 'savingsGoals.detail.target' | transloco }}
                  </dt>
                  <dd
                    class="ph-no-capture mt-0.5 text-headline-small font-bold text-financial-savings"
                    data-testid="savings-goal-target-amount"
                  >
                    {{
                      goal().targetAmount | appCurrency: currency() : '1.0-0'
                    }}
                  </dd>
                </div>
              }
              @if (goal().startDate || goal().targetDate) {
                <div class="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  @if (goal().startDate) {
                    <div class="flex items-baseline gap-1.5">
                      <dt class="text-label-small text-on-surface-variant">
                        {{ 'savingsGoals.startDate' | transloco }}
                      </dt>
                      <dd
                        class="text-body-medium text-on-surface"
                        data-testid="savings-goal-start-date"
                      >
                        {{ goal().startDate | date: shortDateFormat() }}
                      </dd>
                    </div>
                  }
                  @if (goal().targetDate) {
                    <div class="flex items-baseline gap-1.5">
                      <dt class="text-label-small text-on-surface-variant">
                        {{ 'savingsGoals.targetDate' | transloco }}
                      </dt>
                      <dd
                        class="text-body-medium text-on-surface"
                        data-testid="savings-goal-target-date"
                      >
                        {{ goal().targetDate | date: shortDateFormat() }}
                      </dd>
                    </div>
                  }
                </div>
              }
            </dl>
          }

          <div
            class="mt-auto flex items-center justify-between gap-3 pt-5 text-label-large text-primary"
          >
            <span>{{ 'savingsGoals.openGoal' | transloco }}</span>
            <mat-icon aria-hidden="true" class="savings-goal-card__arrow"
              >arrow_forward</mat-icon
            >
          </div>
        </mat-card-content>
      </mat-card>
    </a>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }

    .savings-goal-link {
      color: inherit;
      text-decoration: none;
    }

    .savings-goal-link:focus-visible {
      outline: 3px solid var(--mat-sys-primary);
      outline-offset: 3px;
      border-radius: var(--mat-sys-corner-large);
    }

    .savings-goal-card {
      background: color-mix(
        in srgb,
        var(--mat-sys-surface-container-low) 18%,
        var(--mat-sys-surface)
      );
      transition:
        background-color var(--pulpe-motion-fast) var(--pulpe-ease-standard),
        border-color var(--pulpe-motion-fast) var(--pulpe-ease-standard),
        transform var(--pulpe-motion-fast) var(--pulpe-ease-standard);
    }

    .savings-goal-card--completed {
      background: color-mix(
        in srgb,
        var(--mat-sys-primary-container) 22%,
        var(--mat-sys-surface)
      );
    }

    .savings-goal-link:hover .savings-goal-card {
      background: var(--mat-sys-surface-container-low);
      border-color: var(--mat-sys-outline);
      transform: translateY(-1px);
    }

    .savings-goal-card__arrow {
      transition: transform var(--pulpe-motion-fast) var(--pulpe-ease-standard);
    }

    .savings-goal-link:hover .savings-goal-card__arrow,
    .savings-goal-link:focus-visible .savings-goal-card__arrow {
      transform: translateX(4px);
    }

    @media (prefers-reduced-motion: reduce) {
      .savings-goal-card,
      .savings-goal-card__arrow {
        transition: none;
      }

      .savings-goal-link:hover .savings-goal-card,
      .savings-goal-link:hover .savings-goal-card__arrow,
      .savings-goal-link:focus-visible .savings-goal-card__arrow {
        transform: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavingsGoalCard {
  readonly #settings = inject(UserSettingsStore);

  readonly goal = input.required<SavingsGoal>();

  protected readonly routes = ROUTES;
  protected readonly currency = this.#settings.currency;
  protected readonly shortDateFormat = computed(
    () => getDateDisplayFormats(this.currency()).shortDate,
  );

  protected readonly statusLabelKey = computed(() =>
    statusLabelKeyFor(this.goal().status),
  );
  protected readonly isActive = computed(() => this.goal().status === 'ACTIVE');
  protected readonly isCompleted = computed(
    () => this.goal().status === 'COMPLETED',
  );
}

function statusLabelKeyFor(status: SavingsGoalStatus): string {
  switch (status) {
    case 'COMPLETED':
      return 'savingsGoals.statusCompleted';
    case 'PAUSED':
      return 'savingsGoals.statusPaused';
    default:
      return 'savingsGoals.statusActive';
  }
}
