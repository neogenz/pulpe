import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { type SavingsGoal, type SavingsGoalStatus } from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';
import { getDateDisplayFormats } from '@core/date/date-display-formats';
import { UserSettingsStore } from '@core/user-settings';

@Component({
  selector: 'pulpe-savings-goal-card',
  imports: [
    DatePipe,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    TranslocoPipe,
    AppCurrencyPipe,
  ],
  template: `
    <mat-card
      appearance="outlined"
      class="savings-goal-card cursor-pointer h-full"
      (click)="openDetail.emit(goal())"
      [attr.data-testid]="'savings-goal-' + goal().name"
    >
      <mat-card-content class="flex flex-col gap-3 p-4!">
        <div class="flex items-start justify-between gap-2">
          <div
            class="flex justify-center items-center size-10 rounded-full bg-financial-savings/10 text-financial-savings shrink-0"
          >
            <mat-icon aria-hidden="true">savings</mat-icon>
          </div>
          <mat-chip class="!h-6 !text-label-small bg-surface-container">
            {{ statusLabelKey() | transloco }}
          </mat-chip>
        </div>

        <h2 class="text-title-medium font-medium ph-no-capture line-clamp-2">
          {{ goal().name }}
        </h2>

        <div class="flex items-end justify-between gap-2 mt-auto">
          <span
            class="ph-no-capture text-headline-small font-bold text-financial-savings"
          >
            {{ goal().targetAmount | appCurrency: currency() : '1.2-2' }}
          </span>
          <span
            class="text-body-small text-on-surface-variant"
            data-testid="savings-goal-target-date"
          >
            {{ 'savingsGoals.targetDate' | transloco }} :
            {{ goal().targetDate | date: shortDateFormat() }}
          </span>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
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
  readonly openDetail = output<SavingsGoal>();

  protected readonly currency = this.#settings.currency;
  protected readonly shortDateFormat = computed(
    () => getDateDisplayFormats(this.currency()).shortDate,
  );

  protected readonly statusLabelKey = computed(() =>
    statusLabelKeyFor(this.goal().status),
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
