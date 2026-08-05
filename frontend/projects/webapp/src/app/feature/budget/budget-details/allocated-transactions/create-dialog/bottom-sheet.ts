import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { type TransactionCreate } from 'pulpe-shared';

import { BlurOnVisibilityResumeDirective } from '@ui/blur-on-visibility-resume/blur-on-visibility-resume.directive';
import { CreateAllocatedTransactionForm } from './form';
import { type CreateAllocatedTransactionDialogData } from './dialog';

@Component({
  selector: 'pulpe-create-allocated-transaction-bottom-sheet',
  imports: [
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
    CreateAllocatedTransactionForm,
    BlurOnVisibilityResumeDirective,
  ],
  template: `
    <div class="flex flex-col gap-4 pb-6" pulpeBlurOnVisibilityResume>
      <div
        class="w-9 h-1 bg-outline-variant rounded-sm mx-auto mt-3 mb-2"
      ></div>

      <div class="flex justify-between items-center">
        <h2 class="text-title-large text-on-surface m-0">
          {{
            'budget.newTransactionTitle'
              | transloco: { name: data.budgetLine.name }
          }}
        </h2>
        <button
          matIconButton
          (click)="close()"
          [attr.aria-label]="'common.close' | transloco"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <pulpe-create-allocated-transaction-form
        #form
        [data]="data"
        (created)="onCreated($event)"
      />

      @if (submitError(); as error) {
        <p
          role="alert"
          class="text-error text-body-small"
          data-testid="transaction-submit-error"
        >
          {{ error }}
        </p>
      }

      <div class="flex gap-3 pt-2">
        <button
          matButton
          (click)="close()"
          [disabled]="isSubmitting()"
          class="flex-1"
        >
          {{ 'common.cancel' | transloco }}
        </button>
        <button
          matButton="filled"
          (click)="submit()"
          [disabled]="!form.canSubmit() || isSubmitting()"
          class="flex-2"
        >
          <mat-icon>add</mat-icon>
          {{ 'budget.transactionCreateButton' | transloco }}
        </button>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateAllocatedTransactionBottomSheet {
  readonly #bottomSheetRef = inject(
    MatBottomSheetRef<CreateAllocatedTransactionBottomSheet, TransactionCreate>,
  );
  readonly data = inject<CreateAllocatedTransactionDialogData>(
    MAT_BOTTOM_SHEET_DATA,
  );
  protected readonly form =
    viewChild.required<CreateAllocatedTransactionForm>('form');

  protected readonly isSubmitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  close(): void {
    this.#bottomSheetRef.dismiss();
  }

  submit(): void {
    void this.form().submit();
  }

  async onCreated(tx: TransactionCreate): Promise<void> {
    // Re-entry guard mirrors runFormSubmit: a second submit arriving before
    // the disabled button re-renders is dropped.
    if (this.isSubmitting()) return;
    this.isSubmitting.set(true);
    this.submitError.set(null);
    try {
      const error = await this.data.submit(tx);
      if (error) {
        this.submitError.set(error);
        return;
      }
      this.#bottomSheetRef.dismiss(tx);
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
