import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import type { OnboardingTransaction } from '@core/complete-profile';

@Component({
  selector: 'pulpe-add-custom-expense-dialog',
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      {{ 'completeProfile.customExpense.dialogTitle' | transloco }}
    </h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="flex flex-col gap-4 density-1">
        <mat-button-toggle-group
          formControlName="kind"
          [hideSingleSelectionIndicator]="true"
          class="w-full"
          [attr.aria-label]="
            'completeProfile.customExpense.kindToggleAriaLabel' | transloco
          "
          data-testid="custom-expense-kind"
        >
          <mat-button-toggle value="expense" class="flex-1">
            {{ 'completeProfile.customExpense.kindExpense' | transloco }}
          </mat-button-toggle>
          <mat-button-toggle value="saving" class="flex-1">
            {{ 'completeProfile.customExpense.kindSaving' | transloco }}
          </mat-button-toggle>
          <mat-button-toggle value="income" class="flex-1">
            {{ 'completeProfile.customExpense.kindIncome' | transloco }}
          </mat-button-toggle>
        </mat-button-toggle-group>

        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="w-full"
        >
          <mat-label>{{
            'completeProfile.customExpense.nameLabel' | transloco
          }}</mat-label>
          <input
            matInput
            formControlName="name"
            maxlength="100"
            [placeholder]="
              'completeProfile.customExpense.namePlaceholder' | transloco
            "
            data-testid="custom-expense-name"
          />
          @if (form.controls.name.hasError('maxlength')) {
            <mat-error>
              {{ 'completeProfile.customExpense.nameMaxLength' | transloco }}
            </mat-error>
          }
        </mat-form-field>

        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="w-full ph-no-capture"
        >
          <mat-label class="ph-no-capture">{{
            'completeProfile.customExpense.amountLabel' | transloco
          }}</mat-label>
          <input
            matInput
            type="number"
            formControlName="amount"
            placeholder="0.00"
            step="0.01"
            min="0"
            inputmode="decimal"
            data-testid="custom-expense-amount"
          />
          <span matTextSuffix>CHF</span>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton (click)="cancel()" data-testid="custom-expense-cancel">
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        matButton="filled"
        color="primary"
        (click)="submit()"
        [disabled]="!form.valid"
        data-testid="custom-expense-submit"
      >
        <mat-icon>add</mat-icon>
        {{ 'common.add' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddCustomExpenseDialog {
  readonly #dialogRef = inject(MatDialogRef<AddCustomExpenseDialog>);
  readonly #fb = inject(FormBuilder);

  protected readonly form = this.#fb.group({
    kind: ['expense' as 'income' | 'expense' | 'saving'],
    name: [
      '',
      [
        Validators.required,
        Validators.maxLength(100),
        Validators.pattern(/\S/),
      ],
    ],
    amount: [
      null as number | null,
      [Validators.required, Validators.min(0.01)],
    ],
  });

  protected submit(): void {
    if (this.form.valid) {
      const value = this.form.getRawValue();
      const transaction: OnboardingTransaction = {
        name: value.name!.trim(),
        amount: value.amount!,
        type: value.kind!,
        expenseType: 'fixed',
        isRecurring: true,
      };
      this.#dialogRef.close(transaction);
    }
  }

  protected cancel(): void {
    this.#dialogRef.close();
  }
}
