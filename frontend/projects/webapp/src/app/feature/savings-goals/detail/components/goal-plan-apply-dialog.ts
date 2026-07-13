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
import { formatBudgetPeriod, type SupportedCurrency } from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';

export interface GoalPlanApplyChange {
  month: number;
  year: number;
  before: number;
  after: number;
}

export interface GoalPlanApplyDialogData {
  changes: GoalPlanApplyChange[];
  currency: SupportedCurrency;
  locale: string;
  payDayOfMonth: number | null;
  verdict: string;
}

const MAX_DIFF_ROWS = 5;

/**
 * Pilier C — récap « On met ton plan à jour ? » (docs/SAVINGS_PLAN.md §2). Diff
 * condensé (cas uniforme : « 600 → 450 /mois sur N mois » ; cas mixte : liste
 * avant→après jusqu'à 5 rows + « et N autres »), ligne de clôture = verdict de
 * projection. L'édition horizon Mois Type est reportée en v1+ (le DTO `months[]`
 * ne bucketise que les budget_lines) → écriture month-scoped uniquement. Ne fait
 * AUCUNE mutation : renvoie la confirmation, la page exécute l'écriture pessimiste.
 */
@Component({
  selector: 'pulpe-goal-plan-apply-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
    AppCurrencyPipe,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ 'savingsGoals.simulate.applyTitle' | transloco }}
    </h2>
    <mat-dialog-content class="flex flex-col gap-4">
      <p class="text-body-medium text-on-surface">
        {{
          'savingsGoals.simulate.applyCount'
            | transloco: { count: data.changes.length }
        }}
      </p>

      @if (uniformChange(); as u) {
        <p
          class="ph-no-capture text-body-large tabular-nums"
          data-testid="goal-plan-apply-uniform"
        >
          <span class="text-on-surface-variant"
            >{{ u.before | appCurrency: data.currency : '1.2-2' }} &rarr;
          </span>
          <span class="font-semibold">{{
            u.after | appCurrency: data.currency : '1.2-2'
          }}</span>
          <span class="text-on-surface-variant">
            {{
              'savingsGoals.simulate.applyPerMonth'
                | transloco: { count: data.changes.length }
            }}</span
          >
        </p>
      } @else {
        <ul class="flex flex-col gap-2" data-testid="goal-plan-apply-diff">
          @for (row of visibleChanges(); track row.year * 12 + row.month) {
            <li
              class="flex items-center justify-between gap-4 text-body-medium"
            >
              <span class="text-on-surface-variant">{{
                formatPeriod(row)
              }}</span>
              <span class="ph-no-capture shrink-0 tabular-nums">
                <span class="text-on-surface-variant"
                  >{{ row.before | appCurrency: data.currency : '1.2-2' }}
                  &rarr;
                </span>
                <span class="font-semibold text-on-surface">{{
                  row.after | appCurrency: data.currency : '1.2-2'
                }}</span>
              </span>
            </li>
          }
          @if (hiddenCount() > 0) {
            <li class="text-body-small text-on-surface-variant">
              {{
                'savingsGoals.simulate.applyMore'
                  | transloco: { count: hiddenCount() }
              }}
            </li>
          }
        </ul>
      }

      @if (data.verdict) {
        <div
          class="flex items-start gap-2 rounded-xl bg-financial-savings/10 px-3 py-2.5"
          data-testid="goal-plan-apply-verdict"
        >
          <mat-icon
            class="mt-0.5 shrink-0 text-financial-savings text-lg! w-auto! h-auto! leading-none"
            aria-hidden="true"
            >flag</mat-icon
          >
          <p class="text-body-medium font-medium text-financial-savings">
            {{ data.verdict }}
          </p>
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close data-testid="goal-plan-apply-cancel">
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        matButton="filled"
        (click)="confirm()"
        data-testid="goal-plan-apply-confirm"
      >
        {{
          'savingsGoals.simulate.applyConfirm'
            | transloco: { count: data.changes.length }
        }}
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoalPlanApplyDialog {
  readonly #dialogRef =
    inject<MatDialogRef<GoalPlanApplyDialog, boolean>>(MatDialogRef);
  protected readonly data = inject<GoalPlanApplyDialogData>(MAT_DIALOG_DATA);

  protected readonly uniformChange = computed(() => {
    const changes = this.data.changes;
    if (changes.length === 0) return null;
    const first = changes[0];
    const isUniform = changes.every(
      (change) =>
        change.before === first.before && change.after === first.after,
    );
    return isUniform ? { before: first.before, after: first.after } : null;
  });

  protected readonly visibleChanges = computed(() =>
    this.data.changes.slice(0, MAX_DIFF_ROWS),
  );

  protected readonly hiddenCount = computed(() =>
    Math.max(0, this.data.changes.length - MAX_DIFF_ROWS),
  );

  protected formatPeriod(change: GoalPlanApplyChange): string {
    return formatBudgetPeriod(
      change.month,
      change.year,
      this.data.payDayOfMonth,
      this.data.locale,
    );
  }

  protected confirm(): void {
    this.#dialogRef.close(true);
  }
}
