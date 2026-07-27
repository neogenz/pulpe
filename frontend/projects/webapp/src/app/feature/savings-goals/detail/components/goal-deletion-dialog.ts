import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  formatBudgetPeriod,
  type SavingsGoalDeletionCommand,
  type SavingsGoalDeletionImpact,
  type SavingsGoalDeletionMode,
  type SupportedCurrency,
} from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';
import { SavingsGoalStore } from '../../services/savings-goals-store';

export interface GoalDeletionDialogData {
  goalId: string;
  goalName: string;
  currency: SupportedCurrency;
  locale: string;
  payDayOfMonth: number | null;
}

type ForecastScope = 'goal_only' | 'goal_and_forecasts';

@Component({
  selector: 'pulpe-goal-deletion-dialog',
  imports: [
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    TranslocoPipe,
    AppCurrencyPipe,
  ],
  templateUrl: './goal-deletion-dialog/goal-deletion-dialog.html',
  styleUrl: './goal-deletion-dialog/goal-deletion-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoalDeletionDialog {
  readonly #store = inject(SavingsGoalStore);
  readonly #dialogRef =
    inject<MatDialogRef<GoalDeletionDialog, SavingsGoalDeletionCommand>>(
      MatDialogRef,
    );
  protected readonly data = inject<GoalDeletionDialogData>(MAT_DIALOG_DATA);

  readonly #impact = signal<SavingsGoalDeletionImpact | null>(null);
  protected readonly impact = this.#impact.asReadonly();
  protected readonly isLoading = signal(true);
  protected readonly hasLoadError = signal(false);
  protected readonly scope = signal<ForecastScope>('goal_only');
  protected readonly deleteTransactions = signal(false);

  protected readonly budgets = computed(() =>
    [...(this.#impact()?.budgets ?? [])].sort(
      (left, right) =>
        left.year * 12 + left.month - (right.year * 12 + right.month),
    ),
  );

  protected readonly mode = computed<SavingsGoalDeletionMode>(() => {
    if (this.scope() === 'goal_only') return 'goal_only';
    return this.deleteTransactions()
      ? 'goal_forecasts_and_transactions'
      : 'goal_and_forecasts';
  });

  protected readonly confirmLabelKey = computed(() => {
    switch (this.mode()) {
      case 'goal_forecasts_and_transactions':
        return 'savingsGoals.deletion.confirmAll';
      case 'goal_and_forecasts':
        return 'savingsGoals.deletion.confirmForecasts';
      default:
        return 'savingsGoals.deletion.confirmGoalOnly';
    }
  });

  constructor() {
    void this.loadImpact();
  }

  protected async loadImpact(): Promise<void> {
    this.isLoading.set(true);
    this.hasLoadError.set(false);
    this.#impact.set(null);
    try {
      this.#impact.set(await this.#store.fetchDeletionImpact(this.data.goalId));
    } catch {
      this.hasLoadError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  protected selectScope(scope: ForecastScope): void {
    this.scope.set(scope);
    if (scope === 'goal_only') this.deleteTransactions.set(false);
  }

  protected formatPeriod(month: number, year: number): string {
    return formatBudgetPeriod(
      month,
      year,
      this.data.payDayOfMonth,
      this.data.locale,
    );
  }

  protected confirm(): void {
    const impact = this.#impact();
    if (!impact) return;
    this.#dialogRef.close({
      mode: this.mode(),
      revision: impact.revision,
    });
  }
}
