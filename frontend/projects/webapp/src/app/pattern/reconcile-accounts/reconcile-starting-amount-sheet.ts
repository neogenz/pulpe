import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  CURRENCY_METADATA,
  parseAccountAmount,
  type SupportedCurrency,
} from 'pulpe-shared';

import { UNREADABLE_AMOUNT } from './reconcile-accounts-step';

export interface StartingAmountSheetData {
  readonly amount: number;
  readonly currency: SupportedCurrency;
}

/** Corrects the money from before Pulpe; closes with the new amount, or nothing when left. */
@Component({
  selector: 'pulpe-reconcile-starting-amount-sheet',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form
      class="flex flex-col gap-4 p-5"
      (ngSubmit)="save()"
      data-testid="reconcile-starting-amount-sheet"
    >
      <div class="flex items-center justify-between gap-2">
        <h2 class="m-0 text-title-large font-bold">
          {{ 'currentMonth.reconcile.compare.startingAmountTitle' | transloco }}
        </h2>
        <button
          matIconButton
          type="button"
          class="-mr-2"
          (click)="close(undefined)"
          [attr.aria-label]="'common.close' | transloco"
          data-testid="reconcile-starting-close-button"
        >
          <mat-icon aria-hidden="true">close</mat-icon>
        </button>
      </div>
      <mat-form-field
        appearance="outline"
        subscriptSizing="dynamic"
        class="ph-no-capture w-full"
      >
        <mat-label>{{
          'currentMonth.reconcile.compare.startingAmountLabel' | transloco
        }}</mat-label>
        <span matTextPrefix class="pr-2 text-sm text-on-surface-variant">{{
          currencySymbol
        }}</span>
        <input
          matInput
          cdkFocusInitial
          name="amount"
          inputmode="decimal"
          autocomplete="off"
          class="tabular-nums"
          [ngModel]="text()"
          (ngModelChange)="text.set($event)"
          [errorStateMatcher]="unreadableAmount"
          data-testid="reconcile-starting-amount-input"
        />
        <mat-error>{{
          'currentMonth.reconcile.accounts.invalidAmount' | transloco
        }}</mat-error>
      </mat-form-field>
      <div class="flex flex-wrap justify-end gap-2">
        <button
          matButton
          type="button"
          (click)="close(0)"
          data-testid="reconcile-starting-reset-button"
        >
          {{ 'currentMonth.reconcile.compare.resetStartingAmount' | transloco }}
        </button>
        <button
          matButton="filled"
          type="submit"
          [disabled]="amount() === null"
          data-testid="reconcile-starting-save-button"
        >
          {{ 'common.save' | transloco }}
        </button>
      </div>
    </form>
  `,
})
export class ReconcileStartingAmountSheet {
  readonly #dialogRef = inject(MatDialogRef, { optional: true });
  readonly #sheetRef = inject(MatBottomSheetRef, { optional: true });
  readonly #data: StartingAmountSheetData =
    inject(MAT_DIALOG_DATA, { optional: true }) ??
    inject(MAT_BOTTOM_SHEET_DATA);

  protected readonly unreadableAmount = UNREADABLE_AMOUNT;
  protected readonly currencySymbol =
    CURRENCY_METADATA[this.#data.currency].symbol;
  protected readonly text = signal(this.#data.amount.toFixed(2));
  // Blank or unreadable: nothing to save.
  protected readonly amount = computed(() => {
    const amount = parseAccountAmount(this.text());
    return amount.status === 'valid' ? amount.cents / 100 : null;
  });

  protected save(): void {
    const amount = this.amount();
    if (amount !== null) this.close(amount);
  }

  protected close(amount: number | undefined): void {
    if (this.#dialogRef) this.#dialogRef.close(amount);
    else this.#sheetRef?.dismiss(amount);
  }
}
