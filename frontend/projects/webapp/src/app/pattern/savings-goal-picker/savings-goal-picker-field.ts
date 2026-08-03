import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, map } from 'rxjs';
import { cachedResource } from 'ngx-ziflux';
import { formatDate } from 'date-fns';
import {
  getBudgetPeriodForDate,
  parseIsoDateLocal,
  periodIndex,
  type BudgetPeriod,
} from 'pulpe-shared';

import { SavingsGoalApi } from '@core/savings-goal/savings-goal-api';
import { UserSettingsStore } from '@core/user-settings';
import { dateFnsLocaleFor } from '@core/locale';

/**
 * Reusable "Objectif" picker for the 3 CA26 saving-line surfaces.
 *
 * Value-based (not a Signal-Forms field): the caller passes the current
 * `savingsGoalId` via `[value]` and reacts to `(valueChanged)`. A first
 * option maps to `null` ("Aucun objectif").
 *
 * PUL-313 — when the caller supplies the budget's period, goals whose deadline
 * falls before it are listed but disabled: the `enforce_savings_goal_line_link`
 * trigger would reject the link. Listed, not hidden — a goal that silently
 * disappears is unexplainable. Template lines carry no period and stay
 * unfiltered; the trigger only bounds `budget_line`.
 */
@Component({
  selector: 'pulpe-savings-goal-picker-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
  ],
  template: `
    @if (isLoading()) {
      <div
        class="flex items-center gap-2 py-2 text-body-small text-on-surface-variant"
        role="status"
        data-testid="savings-goal-picker-loading"
      >
        <mat-progress-spinner mode="indeterminate" [diameter]="20" />
        {{ 'common.loading' | transloco }}
      </div>
    } @else if (error()) {
      <div
        class="flex items-center justify-between gap-3 py-2 text-body-small text-error"
        role="alert"
        data-testid="savings-goal-picker-error"
      >
        <span>{{ 'savingsGoals.loadError' | transloco }}</span>
        <button
          matButton="text"
          type="button"
          (click)="reloadGoals()"
          data-testid="savings-goal-picker-retry"
        >
          {{ 'common.retry' | transloco }}
        </button>
      </div>
    } @else {
      <mat-form-field
        appearance="outline"
        subscriptSizing="dynamic"
        class="w-full"
      >
        <mat-label>{{ 'savingsGoals.pickerLabel' | transloco }}</mat-label>
        <mat-select
          [value]="value()"
          (selectionChange)="onSelectionChange($event.value)"
          data-testid="savings-goal-picker-select"
        >
          <mat-option [value]="null">{{
            'savingsGoals.pickerNone' | transloco
          }}</mat-option>
          @for (option of goalOptions(); track option.id) {
            <mat-option
              [value]="option.id"
              [disabled]="option.deadlineLabel !== null"
              [attr.data-testid]="'savings-goal-picker-option-' + option.id"
            >
              {{ option.name }}
              @if (option.deadlineLabel; as deadline) {
                <span class="block text-body-small text-on-surface-variant">
                  {{
                    'savingsGoals.pickerOutsideHorizon'
                      | transloco: { month: deadline }
                  }}
                </span>
              }
            </mat-option>
          }
        </mat-select>
      </mat-form-field>
      @if (goals().length === 0) {
        <p
          class="mt-1 text-body-small text-on-surface-variant"
          data-testid="savings-goal-picker-empty"
        >
          {{ 'savingsGoals.pickerEmpty' | transloco }}
        </p>
      }
    }
  `,
})
export class SavingsGoalPickerField {
  readonly value = input<string | null>(null);
  /** Budget period the line will live in. Omitted on template lines. */
  readonly budgetPeriod = input<BudgetPeriod | null>(null);
  readonly valueChanged = output<string | null>();

  readonly #api = inject(SavingsGoalApi);
  readonly #settings = inject(UserSettingsStore);

  // Shares the SavingsGoalApi DataCache (key ['savings-goals','list']) with
  // SavingsGoalStore: dedups the fetch across pickers/list and picks up store
  // invalidations.
  readonly #goalsResource = cachedResource({
    cache: this.#api.cache,
    cacheKey: ['savings-goals', 'list'],
    loader: () => this.#api.getAll$().pipe(map((r) => r.data ?? [])),
  });

  protected readonly goals = computed(() => this.#goalsResource.value() ?? []);
  protected readonly isLoading = this.#goalsResource.isInitialLoading;
  protected readonly error = this.#goalsResource.error;

  /**
   * `deadlineLabel` is non-null exactly when the goal is out of horizon: it
   * both disables the option and names the month that puts it out of reach.
   * Mirrors the trigger's own arithmetic via the shared period calculator —
   * an undated goal has no horizon, so it is never out of it.
   */
  protected readonly goalOptions = computed(() => {
    const period = this.budgetPeriod();
    const payDay = this.#settings.payDayOfMonth();
    const locale = dateFnsLocaleFor(this.#settings.currency());

    return this.goals().map((goal) => {
      if (!period || !goal.targetDate) {
        return { id: goal.id, name: goal.name, deadlineLabel: null };
      }
      const deadline = getBudgetPeriodForDate(
        parseIsoDateLocal(goal.targetDate),
        payDay,
      );
      const isOutsideHorizon = periodIndex(period) > periodIndex(deadline);
      return {
        id: goal.id,
        name: goal.name,
        deadlineLabel: isOutsideHorizon
          ? formatDate(
              new Date(deadline.year, deadline.month - 1, 1),
              'MMMM yyyy',
              { locale },
            )
          : null,
      };
    });
  });

  /**
   * Set once the user picks in THIS picker, as opposed to the link the caller
   * handed us. The distinction decides who may be auto-unlinked below.
   */
  readonly #pickedHere = signal(false);

  protected onSelectionChange(goalId: string | null): void {
    this.#pickedHere.set(true);
    this.valueChanged.emit(goalId);
  }

  /**
   * True when the selection must be withdrawn. Disabling the option is not
   * enough on its own: the caller can widen the period AFTER a goal was picked
   * (a spread range extended past the deadline), leaving a stale id that would
   * still submit. Reuses `goalOptions` — the very list the template disables
   * from — so nothing shown as unselectable can survive as a selection.
   *
   * The two reasons are NOT symmetric. A goal that vanished can never be saved
   * again, so it goes whoever chose it. A goal that is merely out of horizon
   * was legitimately linkable when the line was saved, and an edit surface
   * opens carrying it — dropping that on open would edit the user's data for
   * them, so only a pick made here is taken back.
   *
   * The raw resource value gates the whole thing: the option list collapses to
   * `[]` while loading or errored, and clearing on that would wipe a valid pick.
   */
  readonly #hasStaleSelection = computed(() => {
    if (
      this.#goalsResource.error() ||
      this.#goalsResource.value() === undefined
    )
      return false;
    const selectedId = this.value();
    if (selectedId === null) return false;
    const selected = this.goalOptions().find(
      (option) => option.id === selectedId,
    );
    if (!selected) return true;
    return selected.deadlineLabel !== null && this.#pickedHere();
  });

  constructor() {
    toObservable(this.#hasStaleSelection)
      .pipe(filter(Boolean), takeUntilDestroyed())
      .subscribe(() => this.valueChanged.emit(null));
  }

  protected reloadGoals(): void {
    this.#goalsResource.reload();
  }
}
