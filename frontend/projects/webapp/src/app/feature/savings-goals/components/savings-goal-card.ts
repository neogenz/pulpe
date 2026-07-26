import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
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
    MatChipsModule,
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
        class="savings-goal-card cursor-pointer h-full transition-[box-shadow,transform] duration-150 ease-out motion-safe:active:scale-[0.98]"
      >
        <mat-card-content class="flex flex-col gap-3 p-4!">
          <div class="flex items-start justify-between gap-2">
            <div
              class="flex justify-center items-center size-10 rounded-full bg-financial-savings/10 text-financial-savings shrink-0"
            >
              <mat-icon aria-hidden="true">savings</mat-icon>
            </div>
            <!-- Chip only when the status carries a real signal: an « Actif » chip on
                 every card is repetition, not information. COMPLETED reads positive
                 (savings green, RG-002), PAUSED stays neutral. -->
            @if (!isActive()) {
              <mat-chip
                class="!h-6 !text-label-small"
                [ngClass]="
                  isCompleted()
                    ? 'bg-financial-savings/10 text-financial-savings'
                    : 'bg-surface-container'
                "
                data-testid="savings-goal-status"
              >
                {{ statusLabelKey() | transloco }}
              </mat-chip>
            }
          </div>

          <h2 class="text-title-medium font-medium ph-no-capture line-clamp-2">
            {{ goal().name }}
          </h2>

          @if (
            goal().targetAmount !== null ||
            goal().startDate ||
            goal().targetDate
          ) {
            <div class="flex items-end justify-between gap-2 mt-auto">
              @if (goal().targetAmount !== null) {
                <span
                  class="ph-no-capture text-headline-small font-bold text-financial-savings"
                  data-testid="savings-goal-target-amount"
                >
                  {{ goal().targetAmount | appCurrency: currency() : '1.0-0' }}
                </span>
              }
              <div class="ml-auto flex flex-col items-end gap-1">
                @if (goal().startDate) {
                  <span
                    class="inline-flex items-center gap-1 text-body-small text-on-surface-variant"
                    [attr.aria-label]="
                      ('savingsGoals.startDate' | transloco) +
                      ' : ' +
                      (goal().startDate | date: shortDateFormat())
                    "
                    data-testid="savings-goal-start-date"
                  >
                    <mat-icon
                      class="text-base! w-auto! h-auto! leading-none"
                      aria-hidden="true"
                      >play_circle</mat-icon
                    >
                    {{ goal().startDate | date: shortDateFormat() }}
                  </span>
                }
                @if (goal().targetDate) {
                  <span
                    class="inline-flex items-center gap-1 text-body-small text-on-surface-variant"
                    [attr.aria-label]="
                      ('savingsGoals.targetDate' | transloco) +
                      ' : ' +
                      (goal().targetDate | date: shortDateFormat())
                    "
                    data-testid="savings-goal-target-date"
                  >
                    <mat-icon
                      class="text-base! w-auto! h-auto! leading-none"
                      aria-hidden="true"
                      >event</mat-icon
                    >
                    {{ goal().targetDate | date: shortDateFormat() }}
                  </span>
                }
              </div>
            </div>
          }
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
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 2px;
      border-radius: var(--mat-sys-corner-medium);
    }

    mat-card.savings-goal-card:hover {
      box-shadow: var(--mat-sys-level1);
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
