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
import { format, parse } from 'date-fns';
import {
  CURRENCY_METADATA,
  savingsGoalStatusSchema,
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
            <mat-error>{{ 'savingsGoals.fieldName' | transloco }}</mat-error>
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
              'savingsGoals.fieldTargetAmount' | transloco
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
            [value]="targetDateAsDate()"
            (dateChange)="onTargetDateChange($event)"
            data-testid="savings-goal-target-date"
            readonly
          />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
          @if (targetDateErrors().required || targetDateErrors().pastDate) {
            <mat-error>{{
              'savingsGoals.fieldTargetDate' | transloco
            }}</mat-error>
          }
        </mat-form-field>

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
      @if (isEdit()) {
        <button
          matButton
          class="delete-action mr-auto"
          (click)="handleDelete()"
          data-testid="savings-goal-delete"
        >
          <mat-icon>delete</mat-icon>
          {{ 'common.delete' | transloco }}
        </button>
      }
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

    .delete-action {
      --mat-text-button-label-text-color: var(--mat-sys-error);
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
      return v >= todayIso() ? null : { kind: 'pastDate' };
    });
  });

  protected readonly canSubmit = computed(() => this.goalForm().valid());

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
      ? buildSavingsGoalUpdate(value)
      : buildSavingsGoalCreate(value);
    this.#dialogRef.close(result);
  }

  handleCancel(): void {
    this.#dialogRef.close();
  }

  handleDelete(): void {
    this.#dialogRef.close({ delete: true });
  }
}
