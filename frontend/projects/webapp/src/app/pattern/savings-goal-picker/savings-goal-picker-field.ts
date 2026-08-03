import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { combineLatest, map } from 'rxjs';
import { cachedResource } from 'ngx-ziflux';

import { SavingsGoalApi } from '@core/savings-goal/savings-goal-api';
import { AppCurrencyPipe } from '@core/currency';

/**
 * Reusable "Objectif" picker.
 *
 * Two modes, deliberately distinct:
 * - `link` (default) — the 3 CA26 saving-line surfaces: which goal a saving
 *   forecast contributes to. Money goes IN.
 * - `withdrawal` (PUL-329) — which goal funds an income. Money goes OUT, so the
 *   list is restricted to goals with a positive balance and the field shows what
 *   is left after the withdrawal.
 *
 * Value-based (not a Signal-Forms field): the caller passes the current
 * `savingsGoalId` via `[value]` and reacts to `(valueChanged)`. In `link` mode a
 * first option maps to `null` ("Aucun objectif"); in `withdrawal` mode the
 * choice is required, so there is no such option.
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
    AppCurrencyPipe,
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
    } @else if (mode() === 'withdrawal') {
      <mat-form-field
        appearance="outline"
        subscriptSizing="dynamic"
        class="w-full"
      >
        <mat-label>{{
          'savingsGoals.withdrawalSourceLabel' | transloco
        }}</mat-label>
        <mat-select
          [value]="value()"
          (selectionChange)="valueChanged.emit($event.value)"
          data-testid="savings-goal-withdrawal-select"
        >
          @for (option of withdrawalOptions(); track option.goalId) {
            <mat-option [value]="option.goalId">
              <span>{{ option.name }}</span>
              <span class="ph-no-capture text-on-surface-variant">
                ·
                {{
                  option.availableAmount
                    | appCurrency: option.currency : '1.0-0'
                }}
              </span>
            </mat-option>
          }
        </mat-select>
      </mat-form-field>
      @if (withdrawalOptions().length === 0) {
        <p
          class="mt-1 text-body-small text-on-surface-variant"
          data-testid="savings-goal-withdrawal-empty"
        >
          {{ 'savingsGoals.withdrawalNoFundedGoal' | transloco }}
        </p>
      } @else if (selectedOption(); as option) {
        <p
          class="mt-1 text-body-small text-on-surface-variant ph-no-capture"
          data-testid="savings-goal-withdrawal-preview"
        >
          {{ option.name }} ·
          {{ option.availableAmount | appCurrency: option.currency : '1.0-0' }}
          →
          {{ remainingAmount() | appCurrency: option.currency : '1.0-0' }}
        </p>
        @if (hasInsufficientBalance()) {
          <p
            class="mt-1 text-body-small text-error"
            role="alert"
            data-testid="savings-goal-withdrawal-insufficient"
          >
            {{ 'savingsGoals.withdrawalInsufficient' | transloco }}
          </p>
        } @else if (option.status === 'COMPLETED') {
          <p
            class="mt-1 text-body-small text-on-surface-variant"
            data-testid="savings-goal-withdrawal-completed-note"
          >
            {{ 'savingsGoals.withdrawalCompletedNote' | transloco }}
          </p>
        }
      }
    } @else {
      <mat-form-field
        appearance="outline"
        subscriptSizing="dynamic"
        class="w-full"
      >
        <mat-label>{{ 'savingsGoals.pickerLabel' | transloco }}</mat-label>
        <mat-select
          [value]="value()"
          (selectionChange)="valueChanged.emit($event.value)"
          data-testid="savings-goal-picker-select"
        >
          <mat-option [value]="null">{{
            'savingsGoals.pickerNone' | transloco
          }}</mat-option>
          @for (g of goals(); track g.id) {
            <mat-option [value]="g.id">{{ g.name }}</mat-option>
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
  readonly valueChanged = output<string | null>();
  readonly mode = input<'link' | 'withdrawal'>('link');
  /**
   * Withdrawal mode only: the amount actually taken out, already converted into
   * the account currency (RG-009). The original typed amount would compare a
   * foreign-currency figure against a balance held in the account currency.
   */
  readonly withdrawalAmount = input<number | null>(null);

  readonly #api = inject(SavingsGoalApi);

  // Shares the SavingsGoalApi DataCache (key ['savings-goals','list']) with
  // SavingsGoalStore: dedups the fetch across pickers/list and picks up store
  // invalidations.
  readonly #goalsResource = cachedResource({
    cache: this.#api.cache,
    cacheKey: ['savings-goals', 'list'],
    params: () => (this.mode() === 'link' ? {} : undefined),
    loader: () => this.#api.getAll$().pipe(map((r) => r.data ?? [])),
  });

  // Server-filtered: only goals whose confirmed balance is positive, whatever
  // their status. The client never rebuilds that eligibility.
  readonly #withdrawalOptionsResource = cachedResource({
    cache: this.#api.cache,
    cacheKey: ['savings-goals', 'withdrawal-options'],
    params: () => (this.mode() === 'withdrawal' ? {} : undefined),
    loader: () => this.#api.getWithdrawalOptions$().pipe(map((r) => r.data)),
  });

  protected readonly goals = computed(() => this.#goalsResource.value() ?? []);
  protected readonly withdrawalOptions = computed(
    () => this.#withdrawalOptionsResource.value() ?? [],
  );

  protected readonly selectedOption = computed(
    () =>
      this.withdrawalOptions().find(
        (option) => option.goalId === this.value(),
      ) ?? null,
  );

  protected readonly remainingAmount = computed(() => {
    const option = this.selectedOption();
    if (!option) return 0;
    return option.availableAmount - (this.withdrawalAmount() ?? 0);
  });

  readonly hasInsufficientBalance = computed(() => this.remainingAmount() < 0);

  /**
   * Withdrawal mode: the selection cannot be committed yet — options are still
   * loading or failed, the converted amount is not resolved, or the amount is
   * over the balance. The backend stays the authority; this only spares the user
   * a round-trip.
   */
  readonly isWithdrawalBlocked = computed(() => {
    if (this.mode() !== 'withdrawal') return false;
    if (this.isLoading() || this.error()) return true;
    if (this.value() === null) return true;
    if (this.selectedOption() === null) return true;
    return this.withdrawalAmount() === null || this.hasInsufficientBalance();
  });

  protected readonly isLoading = computed(() =>
    this.mode() === 'withdrawal'
      ? this.#withdrawalOptionsResource.isInitialLoading()
      : this.#goalsResource.isInitialLoading(),
  );
  protected readonly error = computed(() =>
    this.mode() === 'withdrawal'
      ? this.#withdrawalOptionsResource.error()
      : this.#goalsResource.error(),
  );

  constructor() {
    combineLatest([
      toObservable(this.#goalsResource.value),
      toObservable(this.#goalsResource.error),
      toObservable(this.value),
      toObservable(this.mode),
    ])
      .pipe(takeUntilDestroyed())
      .subscribe(([goals, error, selectedId, mode]) => {
        if (mode !== 'link') return;
        if (error || goals === undefined) return;
        if (
          selectedId !== null &&
          !goals.some((goal) => goal.id === selectedId)
        ) {
          this.valueChanged.emit(null);
        }
      });
  }

  protected reloadGoals(): void {
    if (this.mode() === 'withdrawal') {
      this.#withdrawalOptionsResource.reload();
      return;
    }
    this.#goalsResource.reload();
  }
}
