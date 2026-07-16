import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  formatBudgetPeriod,
  type SavingsGoalFutureLine,
  type SavingsGoalGenerationStop,
  type SavingsGoalStatus,
  type SupportedCurrency,
} from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';

export interface GoalGenerationStopDialogData {
  lines: SavingsGoalFutureLine[];
  status: SavingsGoalStatus;
  currency: SupportedCurrency;
  locale: string;
  payDayOfMonth: number | null;
}

export type GoalGenerationStopDecision = SavingsGoalGenerationStop['mode'];

const MAX_LINE_ROWS = 5;

/**
 * Advisory à l'arrêt de génération (PUL-285 CA8) : liste les prévisions
 * Épargne liées des mois futurs et propose de les figer (garder sans
 * objectif) ou de les retirer — jamais d'écriture ici, la page exécute la
 * décision en pessimiste. Ton neutre, jamais anxiogène (RG-002).
 */
@Component({
  selector: 'pulpe-goal-generation-stop-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
    AppCurrencyPipe,
  ],
  template: `
    <h2 mat-dialog-title>
      {{
        (data.status === 'PAUSED'
          ? 'savingsGoals.generationStop.titlePaused'
          : 'savingsGoals.generationStop.titleCompleted'
        ) | transloco
      }}
    </h2>
    <mat-dialog-content class="flex flex-col gap-4">
      <p class="text-body-medium text-on-surface">
        {{
          'savingsGoals.generationStop.message'
            | transloco: { count: data.lines.length }
        }}
      </p>

      <ul class="flex flex-col gap-2" data-testid="goal-generation-stop-lines">
        @for (line of visibleLines(); track line.budgetLineId) {
          <li class="flex items-center justify-between gap-4 text-body-medium">
            <span class="text-on-surface-variant">{{
              formatPeriod(line)
            }}</span>
            <span class="ph-no-capture shrink-0 tabular-nums font-medium">{{
              line.amount | appCurrency: data.currency : '1.2-2'
            }}</span>
          </li>
        }
        @if (hiddenCount() > 0) {
          <li class="text-body-small text-on-surface-variant">
            {{
              'savingsGoals.generationStop.moreLines'
                | transloco: { count: hiddenCount() }
            }}
          </li>
        }
        <li
          class="flex items-center justify-between gap-4 border-t border-outline-variant pt-2 text-body-medium font-semibold"
        >
          <span>{{ 'savingsGoals.generationStop.total' | transloco }}</span>
          <span class="ph-no-capture shrink-0 tabular-nums">{{
            totalAmount() | appCurrency: data.currency : '1.0-0'
          }}</span>
        </li>
      </ul>

      <div class="flex flex-col gap-3">
        <button
          matButton="filled"
          class="w-full"
          (click)="decide('remove')"
          data-testid="goal-generation-stop-remove"
        >
          <mat-icon>event_busy</mat-icon>
          {{ 'savingsGoals.generationStop.remove' | transloco }}
        </button>
        <p class="text-body-small text-on-surface-variant">
          {{ 'savingsGoals.generationStop.removeHint' | transloco }}
        </p>
        <button
          matButton="outlined"
          class="w-full"
          (click)="decide('freeze')"
          data-testid="goal-generation-stop-freeze"
        >
          <mat-icon>link_off</mat-icon>
          {{ 'savingsGoals.generationStop.freeze' | transloco }}
        </button>
        <p class="text-body-small text-on-surface-variant">
          {{ 'savingsGoals.generationStop.freezeHint' | transloco }}
        </p>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        matButton
        mat-dialog-close
        data-testid="goal-generation-stop-dismiss"
      >
        {{ 'savingsGoals.generationStop.dismiss' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoalGenerationStopDialog {
  readonly #dialogRef =
    inject<MatDialogRef<GoalGenerationStopDialog, GoalGenerationStopDecision>>(
      MatDialogRef,
    );
  protected readonly data =
    inject<GoalGenerationStopDialogData>(MAT_DIALOG_DATA);

  protected readonly visibleLines = computed(() =>
    this.data.lines.slice(0, MAX_LINE_ROWS),
  );

  protected readonly hiddenCount = computed(() =>
    Math.max(0, this.data.lines.length - MAX_LINE_ROWS),
  );

  protected readonly totalAmount = computed(() =>
    this.data.lines.reduce((sum, line) => sum + line.amount, 0),
  );

  protected formatPeriod(line: SavingsGoalFutureLine): string {
    return formatBudgetPeriod(
      line.month,
      line.year,
      this.data.payDayOfMonth,
      this.data.locale,
    );
  }

  protected decide(decision: GoalGenerationStopDecision): void {
    this.#dialogRef.close(decision);
  }
}
