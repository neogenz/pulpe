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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  MatDatepickerModule,
  type MatDatepickerInputEvent,
} from '@angular/material/datepicker';
import {
  FormField,
  form,
  maxLength,
  required,
  validate,
} from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import { addMonths, endOfMonth, format, parse } from 'date-fns';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  CURRENCY_METADATA,
  MAX_SAVINGS_GOAL_PLAN_PERIODS,
  savingsGoalStatusSchema,
  suggestedMonthlyContribution,
  type SavingsGoal,
  type SavingsGoalStatus,
} from 'pulpe-shared';
import { UserSettingsStore } from '@core/user-settings';
import { touchedFieldErrors } from '@core/validators';
import {
  buildSavingsGoalCreate,
  buildSavingsGoalUpdate,
  type SavingsGoalFormValue,
} from './savings-goal-form-dialog.schema';

export interface SavingsGoalFormDialogData {
  goal?: SavingsGoal;
}

const ISO_DATE = 'yyyy-MM-dd';

function todayIso(): string {
  return format(new Date(), ISO_DATE);
}

function isoToDate(value: string): Date | null {
  if (!value) return null;
  const parsed = parse(value, ISO_DATE, new Date());
  return isNaN(parsed.getTime()) ? null : parsed;
}

@Component({
  selector: 'pulpe-savings-goal-form-dialog',
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatSlideToggleModule,
    TranslocoPipe,
    FormField,
  ],
  host: { 'data-testid': 'savings-goal-form-dialog' },
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      {{
        (isEdit() ? 'savingsGoals.editTitle' : 'savingsGoals.createTitle')
          | transloco
      }}
    </h2>

    <mat-dialog-content>
      <div class="flex flex-col gap-4 pt-4">
        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="w-full"
        >
          <mat-label>{{ 'savingsGoals.fieldName' | transloco }}</mat-label>
          <input
            matInput
            [formField]="goalForm.name"
            data-testid="savings-goal-name"
          />
          @if (nameErrors().required) {
            <mat-error>{{ 'savingsGoals.nameRequired' | transloco }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="w-full"
        >
          <mat-label>{{
            'savingsGoals.fieldTargetAmount' | transloco
          }}</mat-label>
          <input
            matInput
            type="number"
            step="0.01"
            inputmode="decimal"
            [formField]="goalForm.targetAmount"
            data-testid="savings-goal-target-amount"
          />
          <span matTextSuffix>{{ currencySymbol() }}</span>
          @if (targetAmountErrors().required) {
            <mat-error>{{
              'savingsGoals.targetAmountRequired' | transloco
            }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="w-full"
        >
          <mat-label>{{
            'savingsGoals.fieldTargetDate' | transloco
          }}</mat-label>
          <input
            matInput
            [matDatepicker]="picker"
            [min]="minDate"
            [max]="maxDate"
            [value]="targetDateAsDate()"
            (dateChange)="onTargetDateChange($event)"
            data-testid="savings-goal-target-date"
            readonly
          />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
          @if (targetDateErrors().required) {
            <mat-error>{{
              'savingsGoals.targetDateRequired' | transloco
            }}</mat-error>
          } @else if (targetDateErrors().pastDate) {
            <mat-error>{{
              'savingsGoals.targetDatePast' | transloco
            }}</mat-error>
          } @else if (targetDateErrors().tooFar) {
            <mat-error>{{
              'savingsGoals.targetDateTooFar' | transloco
            }}</mat-error>
          }
        </mat-form-field>

        @if (!isEdit()) {
          <mat-slide-toggle
            [checked]="decomposeEnabled()"
            (change)="decomposeEnabled.set($event.checked)"
            data-testid="savings-goal-decompose-toggle"
          >
            {{ 'savingsGoals.decomposeToggle' | transloco }}
          </mat-slide-toggle>

          @if (decomposeEnabled()) {
            <mat-form-field
              appearance="outline"
              subscriptSizing="dynamic"
              class="w-full"
            >
              <mat-label>{{
                'savingsGoals.fieldMonthlyContribution' | transloco
              }}</mat-label>
              <input
                matInput
                type="number"
                step="0.01"
                min="0.01"
                inputmode="decimal"
                [value]="monthlyContribution() ?? ''"
                (input)="onMonthlyContributionInput($event)"
                data-testid="savings-goal-monthly-contribution"
              />
              <span matTextSuffix>{{ currencySymbol() }}</span>
              @if (isMonthlyContributionInvalid()) {
                <mat-hint class="text-error">{{
                  'savingsGoals.monthlyContributionInvalid' | transloco
                }}</mat-hint>
              } @else {
                <mat-hint>{{
                  'savingsGoals.decomposeHint' | transloco
                }}</mat-hint>
              }
            </mat-form-field>
          }
        }

        @if (isEdit()) {
          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="w-full"
          >
            <mat-label>{{ 'savingsGoals.fieldStatus' | transloco }}</mat-label>
            <mat-select
              [formField]="goalForm.status"
              data-testid="savings-goal-status"
            >
              @for (status of statusOptions; track status) {
                <mat-option [value]="status">{{
                  statusLabelKey(status) | transloco
                }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="gap-2">
      <button
        matButton
        (click)="handleCancel()"
        data-testid="savings-goal-cancel"
      >
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        matButton="filled"
        (click)="handleSubmit()"
        [disabled]="!canSubmit()"
        data-testid="savings-goal-save"
      >
        <mat-icon>save</mat-icon>
        {{ 'common.save' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavingsGoalFormDialog {
  readonly #dialogRef = inject(MatDialogRef<SavingsGoalFormDialog>);
  readonly #data = inject<SavingsGoalFormDialogData>(MAT_DIALOG_DATA);
  readonly #settings = inject(UserSettingsStore);

  protected readonly isEdit = computed(() => !!this.#data.goal);
  protected readonly statusOptions = savingsGoalStatusSchema.options;
  protected readonly minDate = new Date();
  protected readonly maxDate = endOfMonth(
    addMonths(new Date(), MAX_SAVINGS_GOAL_PLAN_PERIODS - 1),
  );
  readonly #maxTargetDateIso = format(this.maxDate, ISO_DATE);
  protected readonly currencySymbol = computed(
    () => CURRENCY_METADATA[this.#settings.currency()].symbol,
  );

  protected readonly model = signal<SavingsGoalFormValue>({
    name: this.#data.goal?.name ?? '',
    targetAmount: this.#data.goal?.targetAmount ?? 0,
    targetDate: this.#data.goal?.targetDate ?? '',
    status: this.#data.goal?.status ?? 'ACTIVE',
  });

  protected readonly goalForm = form(this.model, (path) => {
    required(path.name, { message: 'savingsGoals.fieldName' });
    maxLength(path.name, 100);
    required(path.targetAmount, { message: 'savingsGoals.fieldTargetAmount' });
    validate(path.targetAmount, ({ value }) =>
      value() > 0 ? null : { kind: 'required' },
    );
    required(path.targetDate, { message: 'savingsGoals.fieldTargetDate' });
    validate(path.targetDate, ({ value }) => {
      const v = value();
      if (!v) return null;
      // An existing goal can legitimately sit past its deadline (it stays
      // ACTIVE) — allow the UNCHANGED original date so status/name/amount edits
      // aren't blocked. Only a new past date (create, or a changed date) fails.
      if (v === this.#data.goal?.targetDate) return null;
      if (v < todayIso()) return { kind: 'pastDate' };
      return v <= this.#maxTargetDateIso ? null : { kind: 'tooFar' };
    });
  });

  // PUL-285 CA6 — opt-in « décomposer en mensualités », création uniquement.
  // Pré-coché ; la suggestion suit cible/échéance tant que l'utilisateur n'a
  // pas saisi son propre montant (vider le champ rend la main à la suggestion).
  protected readonly decomposeEnabled = signal(!this.#data.goal);
  readonly #monthlyContributionOverride = signal<number | null>(null);
  readonly #suggestedMonthly = computed(() => {
    const { targetAmount, targetDate } = this.model();
    if (!targetAmount || targetAmount <= 0 || !targetDate) return null;
    return suggestedMonthlyContribution({
      targetAmount,
      targetDate,
      payDayOfMonth: this.#settings.payDayOfMonth(),
    });
  });
  protected readonly monthlyContribution = computed(
    () => this.#monthlyContributionOverride() ?? this.#suggestedMonthly(),
  );
  // Option active + montant non positif = décomposition silencieusement
  // perdue : on bloque la soumission plutôt que d'omettre le champ.
  protected readonly isMonthlyContributionInvalid = computed(
    () =>
      !this.isEdit() &&
      this.decomposeEnabled() &&
      (this.monthlyContribution() ?? 0) <= 0,
  );

  protected readonly canSubmit = computed(
    () => this.goalForm().valid() && !this.isMonthlyContributionInvalid(),
  );

  protected readonly targetDateAsDate = computed(() =>
    isoToDate(this.model().targetDate),
  );

  protected readonly nameErrors = touchedFieldErrors(
    () => this.goalForm.name,
    'required',
  );
  protected readonly targetAmountErrors = touchedFieldErrors(
    () => this.goalForm.targetAmount,
    'required',
  );
  protected readonly targetDateErrors = touchedFieldErrors(
    () => this.goalForm.targetDate,
    'required',
    'pastDate',
    'tooFar',
  );

  protected statusLabelKey(status: SavingsGoalStatus): string {
    switch (status) {
      case 'COMPLETED':
        return 'savingsGoals.statusCompleted';
      case 'PAUSED':
        return 'savingsGoals.statusPaused';
      default:
        return 'savingsGoals.statusActive';
    }
  }

  protected onMonthlyContributionInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const parsed = Number(raw);
    this.#monthlyContributionOverride.set(
      raw === '' || !Number.isFinite(parsed) ? null : parsed,
    );
  }

  protected onTargetDateChange(event: MatDatepickerInputEvent<Date>): void {
    const date = event.value;
    this.model.update((m) => ({
      ...m,
      targetDate: date ? format(date, ISO_DATE) : '',
    }));
    // Mark the field touched so validation messages can surface.
    this.goalForm.targetDate().markAsTouched();
  }

  handleSubmit(): void {
    if (!this.canSubmit()) return;
    const value = this.model();
    const result = this.isEdit()
      ? buildSavingsGoalUpdate(value, this.#data.goal)
      : buildSavingsGoalCreate(
          value,
          this.decomposeEnabled() ? this.monthlyContribution() : null,
        );
    this.#dialogRef.close(result);
  }

  handleCancel(): void {
    this.#dialogRef.close();
  }
}
