import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
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

function inputNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
            type="text"
            step="0.01"
            inputmode="decimal"
            [formField]="goalForm.targetAmount"
            data-testid="savings-goal-target-amount"
          />
          <span matTextSuffix>{{ currencySymbol() }}</span>
          @if (targetAmountErrors().positive) {
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
            'savingsGoals.fieldInitialAmount' | transloco
          }}</mat-label>
          <input
            matInput
            type="text"
            step="0.01"
            inputmode="decimal"
            [formField]="goalForm.initialAmount"
            data-testid="savings-goal-initial-amount"
          />
          <span matTextSuffix>{{ currencySymbol() }}</span>
          @if (initialAmountErrors().negative) {
            <mat-error>{{
              'savingsGoals.initialAmountNegative' | transloco
            }}</mat-error>
          } @else {
            <mat-hint>{{
              'savingsGoals.initialAmountHint' | transloco
            }}</mat-hint>
          }
        </mat-form-field>

        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="w-full"
        >
          <mat-label>{{ 'savingsGoals.fieldStartDate' | transloco }}</mat-label>
          <input
            matInput
            [matDatepicker]="startPicker"
            [max]="targetDateAsDate()"
            [value]="startDateAsDate()"
            (dateChange)="onStartDateChange($event)"
            data-testid="savings-goal-start-date"
            readonly
          />
          @if (model().startDate) {
            <button
              type="button"
              matIconButton
              matIconSuffix
              (click)="clearStartDate()"
              [attr.aria-label]="'savingsGoals.clearStartDate' | transloco"
              data-testid="savings-goal-clear-start-date"
            >
              <mat-icon>close</mat-icon>
            </button>
          }
          <mat-datepicker-toggle matIconSuffix [for]="startPicker" />
          <mat-datepicker #startPicker />
          @if (startDateErrors().afterTarget) {
            <mat-error>{{
              'savingsGoals.startDateAfterTarget' | transloco
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
          @if (model().targetDate) {
            <button
              type="button"
              matIconButton
              matIconSuffix
              (click)="clearTargetDate()"
              [attr.aria-label]="'savingsGoals.clearTargetDate' | transloco"
              data-testid="savings-goal-clear-target-date"
            >
              <mat-icon>close</mat-icon>
            </button>
          }
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
          @if (targetDateErrors().pastDate) {
            <mat-error>{{
              'savingsGoals.targetDatePast' | transloco
            }}</mat-error>
          } @else if (targetDateErrors().tooFar) {
            <mat-error>{{
              'savingsGoals.targetDateTooFar' | transloco
            }}</mat-error>
          }
        </mat-form-field>

        @if (!isEdit() && hasRemainingToSave()) {
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
              } @else if (model().targetDate) {
                <mat-hint>{{
                  'savingsGoals.decomposeHint' | transloco
                }}</mat-hint>
              } @else {
                <mat-hint>{{
                  'savingsGoals.openContributionHint' | transloco
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
    startDate: this.#data.goal?.startDate ?? '',
    targetAmount:
      this.#data.goal?.targetAmount != null
        ? String(this.#data.goal.targetAmount)
        : '',
    initialAmount:
      this.#data.goal?.initialAmount != null
        ? String(this.#data.goal.initialAmount)
        : '',
    targetDate: this.#data.goal?.targetDate ?? '',
    status: this.#data.goal?.status ?? 'ACTIVE',
  });

  protected readonly goalForm = form(this.model, (path) => {
    required(path.name, { message: 'savingsGoals.fieldName' });
    maxLength(path.name, 100);
    validate(path.targetAmount, ({ value }) => {
      const raw = value();
      const amount = inputNumber(raw);
      return raw === '' || (amount != null && amount > 0)
        ? null
        : { kind: 'positive' };
    });
    validate(path.initialAmount, ({ value }) => {
      const raw = value();
      const amount = inputNumber(raw);
      return raw === '' || (amount != null && amount >= 0)
        ? null
        : { kind: 'negative' };
    });
    validate(path.startDate, ({ value, valueOf }) => {
      const startDate = value();
      const targetDate = valueOf(path.targetDate);
      return startDate && targetDate && startDate > targetDate
        ? { kind: 'afterTarget' }
        : null;
    });
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
  // L'opt-in s'active automatiquement dès que cible + échéance existent
  // (comportement historique), mais reste disponible manuellement pour un pot.
  // Sans cible ni échéance, le nom seul reste immédiatement enregistrable.
  readonly #hasTargetInterval = computed(() => {
    const { targetAmount, targetDate } = this.model();
    const amount = inputNumber(targetAmount);
    return amount != null && amount > 0 && !!targetDate;
  });
  protected readonly decomposeEnabled = linkedSignal(
    () => !this.isEdit() && this.#hasTargetInterval(),
  );
  readonly #monthlyContributionOverride = signal<number | null>(null);
  readonly #suggestedMonthly = computed(() => {
    const { targetAmount, targetDate, initialAmount } = this.model();
    const target = inputNumber(targetAmount);
    if (target == null || target <= 0 || !targetDate) return null;
    return suggestedMonthlyContribution({
      targetAmount: target,
      targetDate,
      // Le montant de départ est déjà acquis : décomposer la cible ENTIÈRE
      // sur-provisionnerait la prévision récurrente générée (PUL-285 CA2).
      initialAmount: inputNumber(initialAmount) ?? 0,
      payDayOfMonth: this.#settings.payDayOfMonth(),
    });
  });
  /** Le montant de départ couvre déjà la cible ⇒ plus rien à décomposer. */
  protected readonly hasRemainingToSave = computed(() => {
    const { targetAmount, initialAmount } = this.model();
    const target = inputNumber(targetAmount);
    return target == null || target - (inputNumber(initialAmount) ?? 0) > 0;
  });
  protected readonly monthlyContribution = computed(
    () => this.#monthlyContributionOverride() ?? this.#suggestedMonthly(),
  );
  // Option active + montant non positif = décomposition silencieusement
  // perdue : on bloque la soumission plutôt que d'omettre le champ. Sans reste
  // à épargner l'option disparaît : bloquer sur un contrôle masqué ferait un
  // cul-de-sac silencieux.
  protected readonly isMonthlyContributionInvalid = computed(
    () =>
      !this.isEdit() &&
      this.hasRemainingToSave() &&
      this.decomposeEnabled() &&
      (this.monthlyContribution() ?? 0) <= 0,
  );

  protected readonly canSubmit = computed(
    () => this.goalForm().valid() && !this.isMonthlyContributionInvalid(),
  );

  protected readonly targetDateAsDate = computed(() =>
    isoToDate(this.model().targetDate),
  );
  protected readonly startDateAsDate = computed(() =>
    isoToDate(this.model().startDate),
  );

  protected readonly nameErrors = touchedFieldErrors(
    () => this.goalForm.name,
    'required',
  );
  protected readonly targetAmountErrors = touchedFieldErrors(
    () => this.goalForm.targetAmount,
    'positive',
  );
  protected readonly initialAmountErrors = touchedFieldErrors(
    () => this.goalForm.initialAmount,
    'negative',
  );
  protected readonly targetDateErrors = touchedFieldErrors(
    () => this.goalForm.targetDate,
    'pastDate',
    'tooFar',
  );
  protected readonly startDateErrors = touchedFieldErrors(
    () => this.goalForm.startDate,
    'afterTarget',
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

  protected onStartDateChange(event: MatDatepickerInputEvent<Date>): void {
    const date = event.value;
    this.model.update((model) => ({
      ...model,
      startDate: date ? format(date, ISO_DATE) : '',
    }));
    this.goalForm.startDate().markAsTouched();
  }

  protected clearStartDate(): void {
    this.model.update((model) => ({ ...model, startDate: '' }));
    this.goalForm.startDate().markAsTouched();
  }

  protected clearTargetDate(): void {
    this.model.update((model) => ({ ...model, targetDate: '' }));
    this.goalForm.targetDate().markAsTouched();
  }

  handleSubmit(): void {
    if (!this.canSubmit()) return;
    const value = this.model();
    const result = this.isEdit()
      ? buildSavingsGoalUpdate(value, this.#data.goal)
      : buildSavingsGoalCreate(
          value,
          this.decomposeEnabled() && this.hasRemainingToSave()
            ? this.monthlyContribution()
            : null,
        );
    this.#dialogRef.close(result);
  }

  handleCancel(): void {
    this.#dialogRef.close();
  }
}
