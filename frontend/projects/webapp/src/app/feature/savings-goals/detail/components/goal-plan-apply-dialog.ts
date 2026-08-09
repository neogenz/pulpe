import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { TranslocoPipe } from '@jsverse/transloco';
import { formatBudgetPeriod, type SupportedCurrency } from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';
import type {
  GoalPlanWithdrawalDecision,
  GoalPlanWithdrawalDestination,
} from '../services/goal-plan-simulator-store';

export interface GoalPlanApplyChange {
  month: number;
  year: number;
  before: number;
  after: number;
  /** Contribution qui reste prévue lorsqu'un retrait est planifié séparément. */
  contributionAmount?: number;
  hasBudget?: boolean;
  planWithdrawalDestination?: GoalPlanWithdrawalDestination;
  planWithdrawalConsumedAmount?: number;
}

export type GoalPlanApplyDialogResult = GoalPlanWithdrawalDecision[] | true;

export interface GoalPlanApplyDialogData {
  mode?: 'adjustment' | 'creation';
  changes: GoalPlanApplyChange[];
  currency: SupportedCurrency;
  locale: string;
  payDayOfMonth: number | null;
  verdict: string;
}

const MAX_DIFF_ROWS = 5;

/**
 * Récap « On met ton plan à jour ? » (docs/SAVINGS.md §10.1). Diff
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
    MatRadioModule,
    TranslocoPipe,
    AppCurrencyPipe,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ titleKey() | transloco }}
    </h2>
    <mat-dialog-content class="flex flex-col gap-4">
      <p class="text-body-medium text-on-surface">
        {{ countKey() | transloco: { count: data.changes.length } }}
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
            @if (row.after < 0) {
              <li
                class="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3 text-body-medium"
                data-testid="goal-plan-withdrawal-breakdown"
              >
                <span class="font-medium text-on-surface">{{
                  formatPeriod(row)
                }}</span>
                <div class="flex items-center justify-between gap-4">
                  <span class="text-on-surface-variant">{{
                    'savingsGoals.simulate.withdrawalContributionPreserved'
                      | transloco
                  }}</span>
                  <span class="ph-no-capture shrink-0 tabular-nums font-medium">
                    +{{
                      contributionAmount(row)
                        | appCurrency: data.currency : '1.2-2'
                    }}
                  </span>
                </div>
                <div class="flex items-center justify-between gap-4">
                  <span class="text-on-surface-variant">{{
                    'savingsGoals.simulate.withdrawalPlanned' | transloco
                  }}</span>
                  <span class="ph-no-capture shrink-0 tabular-nums">
                    <span class="text-on-surface-variant"
                      >{{
                        withdrawalBefore(row)
                          | appCurrency: data.currency : '1.2-2'
                      }}
                      &rarr;
                    </span>
                    <span class="font-semibold text-on-surface">{{
                      row.after | appCurrency: data.currency : '1.2-2'
                    }}</span>
                  </span>
                </div>
                <div
                  class="flex items-center justify-between gap-4 border-t border-outline-variant pt-2"
                >
                  <span class="text-on-surface-variant">{{
                    'savingsGoals.simulate.withdrawalNetEffect' | transloco
                  }}</span>
                  <span
                    class="ph-no-capture shrink-0 tabular-nums font-semibold"
                  >
                    @if (netEffect(row) > 0) {
                      +
                    }
                    {{ netEffect(row) | appCurrency: data.currency : '1.2-2' }}
                  </span>
                </div>
              </li>
            } @else {
              <li
                class="flex items-center justify-between gap-4 text-body-medium"
              >
                <span class="text-on-surface-variant">{{
                  formatPeriod(row)
                }}</span>
                <span class="ph-no-capture shrink-0 tabular-nums">
                  @if (!isCreation()) {
                    <span class="text-on-surface-variant"
                      >{{ row.before | appCurrency: data.currency : '1.2-2' }}
                      &rarr;
                    </span>
                  }
                  <span class="font-semibold text-on-surface">{{
                    row.after | appCurrency: data.currency : '1.2-2'
                  }}</span>
                </span>
              </li>
            }
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
          <p
            class="text-body-medium font-medium text-financial-savings"
            [class.ph-no-capture]="isCreation()"
          >
            {{ data.verdict }}
          </p>
        </div>
      }

      @if (hasWithdrawal()) {
        <section
          class="flex flex-col gap-2"
          aria-labelledby="withdrawal-choice-title"
        >
          <h3
            id="withdrawal-choice-title"
            class="text-title-medium font-semibold"
          >
            {{ 'savingsGoals.simulate.withdrawalChoiceTitle' | transloco }}
          </h3>
          @for (change of withdrawalChanges(); track periodKey(change)) {
            <div
              class="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3"
            >
              <h4
                class="text-body-medium font-semibold"
                [id]="'withdrawal-choice-' + periodKey(change)"
              >
                {{
                  'savingsGoals.simulate.withdrawalChoicePeriod'
                    | transloco: { period: formatPeriod(change) }
                }}
              </h4>
              <mat-radio-group
                class="flex flex-col gap-2"
                [attr.aria-labelledby]="
                  'withdrawal-choice-' + periodKey(change)
                "
                [value]="withdrawalDestination(change)"
                (change)="setWithdrawalDestination(change, $event.value)"
              >
                <mat-radio-button
                  value="goal_only"
                  data-testid="goal-plan-withdrawal-goal-only"
                >
                  <span class="font-medium">{{
                    'savingsGoals.simulate.withdrawalGoalOnlyTitle' | transloco
                  }}</span>
                  <span class="block text-body-small text-on-surface-variant">
                    {{
                      'savingsGoals.simulate.withdrawalGoalOnlyDetail'
                        | transloco
                    }}
                  </span>
                </mat-radio-button>
                <mat-radio-button
                  value="linked_income"
                  [disabled]="!canLinkWithdrawal(change)"
                  data-testid="goal-plan-withdrawal-linked-income"
                >
                  <span class="font-medium">{{
                    'savingsGoals.simulate.withdrawalLinkedTitle' | transloco
                  }}</span>
                  <span class="block text-body-small text-on-surface-variant">
                    {{
                      'savingsGoals.simulate.withdrawalLinkedDetail' | transloco
                    }}
                  </span>
                </mat-radio-button>
              </mat-radio-group>
              @if (!canLinkWithdrawal(change)) {
                <p
                  class="text-body-small text-on-surface-variant"
                  data-testid="goal-plan-withdrawal-no-budget"
                >
                  {{ 'savingsGoals.simulate.withdrawalNoBudget' | transloco }}
                </p>
              }
              @if (isConvertingWithdrawal(change)) {
                <p
                  class="text-body-small text-on-surface-variant"
                  role="status"
                  data-testid="goal-plan-withdrawal-conversion"
                >
                  {{ conversionKey(change) | transloco }}
                </p>
              }
            </div>
          }
        </section>
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
        @if (hasWithdrawal()) {
          {{ withdrawalConfirmKey() | transloco }}
        } @else {
          {{ confirmKey() | transloco: { count: data.changes.length } }}
        }
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoalPlanApplyDialog {
  readonly #dialogRef =
    inject<MatDialogRef<GoalPlanApplyDialog, GoalPlanApplyDialogResult>>(
      MatDialogRef,
    );
  protected readonly data = inject<GoalPlanApplyDialogData>(MAT_DIALOG_DATA);
  protected readonly isCreation = computed(() => this.data.mode === 'creation');
  readonly #withdrawalDestinations = signal(
    new Map(
      this.data.changes
        .filter((change) => change.after < 0)
        .map(
          (change) =>
            [
              this.periodKey(change),
              change.planWithdrawalDestination ?? 'goal_only',
            ] as const,
        ),
    ),
  );
  protected readonly withdrawalChanges = computed(() =>
    this.data.changes.filter((change) => change.after < 0),
  );
  protected readonly hasWithdrawal = computed(
    () => this.withdrawalChanges().length > 0,
  );
  protected readonly titleKey = computed(() =>
    this.isCreation()
      ? 'savingsGoals.simulate.createTitle'
      : 'savingsGoals.simulate.applyTitle',
  );
  protected readonly countKey = computed(() =>
    this.isCreation()
      ? this.data.changes.length === 1
        ? 'savingsGoals.simulate.createCountOne'
        : 'savingsGoals.simulate.createCountMany'
      : 'savingsGoals.simulate.applyCount',
  );
  protected readonly confirmKey = computed(() =>
    this.isCreation()
      ? 'savingsGoals.simulate.createConfirm'
      : 'savingsGoals.simulate.applyConfirm',
  );
  protected readonly withdrawalConfirmKey = computed(() =>
    this.withdrawalChanges().length === 1
      ? 'savingsGoals.simulate.withdrawalConfirmOne'
      : 'savingsGoals.simulate.withdrawalConfirmMany',
  );

  protected readonly uniformChange = computed(() => {
    if (this.isCreation() || this.hasWithdrawal()) return null;
    const changes = this.data.changes;
    if (changes.length === 0) return null;
    const first = changes[0];
    const isUniform = changes.every(
      (change) =>
        change.before === first.before && change.after === first.after,
    );
    return isUniform ? { before: first.before, after: first.after } : null;
  });

  protected readonly visibleChanges = computed(() => {
    if (this.isCreation()) return this.data.changes;
    let visibleNonWithdrawals = 0;
    return this.data.changes.filter(
      (change) =>
        change.before < 0 ||
        change.after < 0 ||
        visibleNonWithdrawals++ < MAX_DIFF_ROWS,
    );
  });

  protected readonly hiddenCount = computed(() =>
    this.isCreation()
      ? 0
      : Math.max(
          0,
          this.data.changes.filter(
            (change) => change.before >= 0 && change.after >= 0,
          ).length - MAX_DIFF_ROWS,
        ),
  );

  protected periodKey(change: GoalPlanApplyChange): number {
    return change.year * 12 + change.month;
  }

  protected contributionAmount(change: GoalPlanApplyChange): number {
    return change.contributionAmount ?? Math.max(0, change.before);
  }

  protected withdrawalBefore(change: GoalPlanApplyChange): number {
    return Math.min(0, change.before);
  }

  protected netEffect(change: GoalPlanApplyChange): number {
    return this.contributionAmount(change) + change.after;
  }

  protected withdrawalDestination(
    change: GoalPlanApplyChange,
  ): GoalPlanWithdrawalDestination {
    return this.#withdrawalDestinations().get(this.periodKey(change))!;
  }

  protected setWithdrawalDestination(
    change: GoalPlanApplyChange,
    destination: GoalPlanWithdrawalDestination,
  ): void {
    this.#withdrawalDestinations.update((destinations) => {
      const next = new Map(destinations);
      next.set(this.periodKey(change), destination);
      return next;
    });
  }

  protected canLinkWithdrawal(change: GoalPlanApplyChange): boolean {
    return change.hasBudget === true;
  }

  protected isConvertingWithdrawal(change: GoalPlanApplyChange): boolean {
    return (
      change.planWithdrawalDestination != null &&
      this.withdrawalDestination(change) !== change.planWithdrawalDestination
    );
  }

  protected conversionKey(change: GoalPlanApplyChange): string {
    return change.planWithdrawalDestination === 'linked_income'
      ? 'savingsGoals.simulate.withdrawalConvertToGoalOnly'
      : 'savingsGoals.simulate.withdrawalConvertToLinked';
  }

  protected formatPeriod(change: GoalPlanApplyChange): string {
    return formatBudgetPeriod(
      change.month,
      change.year,
      this.data.payDayOfMonth,
      this.data.locale,
    );
  }

  protected confirm(): void {
    this.#dialogRef.close(
      this.hasWithdrawal()
        ? this.withdrawalChanges().map((change) => ({
            month: change.month,
            year: change.year,
            destination: this.withdrawalDestination(change),
          }))
        : true,
    );
  }
}
