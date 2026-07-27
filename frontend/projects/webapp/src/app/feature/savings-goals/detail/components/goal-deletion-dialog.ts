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
  template: `
    <h2 mat-dialog-title>
      {{ 'savingsGoals.deletion.title' | transloco }}
    </h2>

    <mat-dialog-content>
      <p class="text-body-medium text-on-surface-variant">
        {{ 'savingsGoals.deletion.intro' | transloco: { name: data.goalName } }}
      </p>

      @if (isLoading()) {
        <div
          class="flex flex-1 flex-col items-center justify-center gap-3 py-10"
          data-testid="goal-deletion-loading"
        >
          <mat-spinner diameter="36" />
          <span class="text-body-medium">{{
            'savingsGoals.deletion.loading' | transloco
          }}</span>
        </div>
      } @else if (hasLoadError()) {
        <div
          class="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center"
          data-testid="goal-deletion-error"
        >
          <mat-icon class="text-error">error_outline</mat-icon>
          <p class="text-body-medium">
            {{ 'savingsGoals.deletion.loadError' | transloco }}
          </p>
          <button
            matButton="outlined"
            (click)="loadImpact()"
            data-testid="goal-deletion-retry"
          >
            {{ 'common.retry' | transloco }}
          </button>
        </div>
      } @else if (impact(); as currentImpact) {
        <section
          class="grid grid-cols-3 gap-2"
          [attr.aria-label]="'savingsGoals.deletion.summaryLabel' | transloco"
          data-testid="goal-deletion-summary"
        >
          <div class="rounded-xl bg-surface-container px-3 py-2">
            <p class="text-label-small text-on-surface-variant">
              {{ 'savingsGoals.deletion.templateSummary' | transloco }}
            </p>
            <p class="text-title-medium tabular-nums">
              {{ currentImpact.summary.templateLineCount }}
            </p>
            <p class="ph-no-capture text-body-small tabular-nums">
              {{
                currentImpact.summary.templateLineTotal
                  | appCurrency: data.currency : '1.2-2'
              }}
            </p>
          </div>
          <div class="rounded-xl bg-surface-container px-3 py-2">
            <p class="text-label-small text-on-surface-variant">
              {{
                'savingsGoals.deletion.budgetSummary'
                  | transloco: { lines: currentImpact.summary.budgetLineCount }
              }}
            </p>
            <p class="text-title-medium tabular-nums">
              {{ currentImpact.summary.budgetCount }}
            </p>
            <p class="ph-no-capture text-body-small tabular-nums">
              {{
                currentImpact.summary.budgetLineTotal
                  | appCurrency: data.currency : '1.2-2'
              }}
            </p>
          </div>
          <div class="rounded-xl bg-surface-container px-3 py-2">
            <p class="text-label-small text-on-surface-variant">
              {{ 'savingsGoals.deletion.transactionSummary' | transloco }}
            </p>
            <p class="text-title-medium tabular-nums">
              {{ currentImpact.summary.transactionCount }}
            </p>
            <p class="ph-no-capture text-body-small tabular-nums">
              {{
                currentImpact.summary.transactionTotal
                  | appCurrency: data.currency : '1.2-2'
              }}
            </p>
          </div>
        </section>

        <mat-radio-group
          [value]="scope()"
          (change)="selectScope($event.value)"
          class="flex flex-col gap-2"
          [attr.aria-label]="'savingsGoals.deletion.scopeLabel' | transloco"
          data-testid="goal-deletion-scope"
        >
          <mat-radio-button
            value="goal_only"
            data-testid="goal-deletion-goal-only"
          >
            <span class="text-body-medium">{{
              'savingsGoals.deletion.goalOnly' | transloco
            }}</span>
          </mat-radio-button>
          <mat-radio-button
            value="goal_and_forecasts"
            data-testid="goal-deletion-forecasts"
          >
            <span class="text-body-medium">{{
              'savingsGoals.deletion.withForecasts' | transloco
            }}</span>
          </mat-radio-button>
        </mat-radio-group>

        @if (
          scope() === 'goal_and_forecasts' &&
          currentImpact.summary.transactionCount > 0
        ) {
          <mat-checkbox
            [checked]="deleteTransactions()"
            (change)="deleteTransactions.set($event.checked)"
            class="ml-7"
            data-testid="goal-deletion-transactions"
          >
            {{ 'savingsGoals.deletion.withTransactions' | transloco }}
          </mat-checkbox>
        }

        <div
          class="min-h-32 flex-1 overflow-y-auto rounded-xl border border-outline-variant p-3"
          role="region"
          tabindex="0"
          [attr.aria-label]="
            'savingsGoals.deletion.impactListLabel' | transloco
          "
          data-testid="goal-deletion-impact-list"
        >
          @if (
            currentImpact.templateLines.length === 0 &&
            currentImpact.budgets.length === 0
          ) {
            <p class="text-body-medium text-on-surface-variant">
              {{ 'savingsGoals.deletion.noLinkedData' | transloco }}
            </p>
          }

          @if (currentImpact.templateLines.length > 0) {
            <section class="mb-5">
              <h3 class="mb-2 text-title-medium">
                {{ 'savingsGoals.deletion.templateSection' | transloco }}
              </h3>
              <ul class="flex flex-col gap-2">
                @for (line of currentImpact.templateLines; track line.lineId) {
                  <li class="flex items-start justify-between gap-4">
                    <span class="min-w-0">
                      <span
                        class="ph-no-capture block truncate text-body-medium"
                      >
                        {{ line.name }}
                      </span>
                      <span
                        class="ph-no-capture block text-body-small text-on-surface-variant"
                      >
                        {{ line.templateName }}
                      </span>
                    </span>
                    <span
                      class="ph-no-capture shrink-0 text-body-medium tabular-nums"
                    >
                      {{ line.amount | appCurrency: data.currency : '1.2-2' }}
                    </span>
                  </li>
                }
              </ul>
            </section>
          }

          @for (budget of budgets(); track budget.budgetId) {
            <section
              class="border-t border-outline-variant py-3 first:border-t-0 first:pt-0"
              data-testid="goal-deletion-budget"
            >
              <h3 class="mb-2 text-title-medium">
                {{ formatPeriod(budget.month, budget.year) }}
              </h3>
              <ul class="flex flex-col gap-3">
                @for (line of budget.lines; track line.lineId) {
                  <li>
                    <div class="flex items-center justify-between gap-4">
                      <span
                        class="ph-no-capture min-w-0 truncate text-body-medium"
                      >
                        {{ line.name }}
                      </span>
                      <span
                        class="ph-no-capture shrink-0 text-body-medium tabular-nums"
                      >
                        {{ line.amount | appCurrency: data.currency : '1.2-2' }}
                      </span>
                    </div>
                    @if (line.transactions.length > 0) {
                      <ul
                        class="ml-4 mt-1 flex flex-col gap-1 border-l border-outline-variant pl-3"
                      >
                        @for (
                          transaction of line.transactions;
                          track transaction.id
                        ) {
                          <li
                            class="flex items-center justify-between gap-4 text-body-small text-on-surface-variant"
                          >
                            <span class="ph-no-capture min-w-0 truncate">
                              {{ transaction.name }}
                            </span>
                            <span class="ph-no-capture shrink-0 tabular-nums">
                              {{
                                transaction.amount
                                  | appCurrency: data.currency : '1.2-2'
                              }}
                            </span>
                          </li>
                        }
                      </ul>
                    }
                  </li>
                }
              </ul>
            </section>
          }
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close data-testid="goal-deletion-cancel">
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        matButton="filled"
        class="warn-theme"
        [disabled]="!impact() || isLoading()"
        (click)="confirm()"
        data-testid="goal-deletion-confirm"
      >
        {{ confirmLabelKey() | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: flex;
      height: 100%;
      min-height: 0;
      flex-direction: column;
    }

    mat-dialog-content {
      display: flex;
      min-height: 0;
      flex: 1;
      flex-direction: column;
      gap: 1rem;
      overflow: hidden;
    }
  `,
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
