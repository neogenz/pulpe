import {
  ChangeDetectionStrategy,
  Component,
  inject,
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
import {
  CreateAllocatedTransactionForm,
  type CreateAllocatedTransactionFormData,
} from './form';

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

      <div class="flex gap-3 pt-2">
        <button matButton (click)="close()" class="flex-1">
          {{ 'common.cancel' | transloco }}
        </button>
        <button
          matButton="filled"
          (click)="submit()"
          [disabled]="!form.canSubmit()"
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
  readonly data = inject<CreateAllocatedTransactionFormData>(
    MAT_BOTTOM_SHEET_DATA,
  );
  protected readonly form =
    viewChild.required<CreateAllocatedTransactionForm>('form');

  close(): void {
    this.#bottomSheetRef.dismiss();
  }

  submit(): void {
    void this.form().submit();
  }

  onCreated(tx: TransactionCreate): void {
    this.#bottomSheetRef.dismiss(tx);
  }
}
