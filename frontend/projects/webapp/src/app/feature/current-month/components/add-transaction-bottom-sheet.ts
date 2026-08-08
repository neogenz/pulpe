import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

import { BlurOnVisibilityResumeDirective } from '@ui/blur-on-visibility-resume/blur-on-visibility-resume.directive';
import { LoadingButton } from '@ui/loading-button/loading-button';
import {
  AddTransactionForm,
  type TransactionFormData,
} from './add-transaction-form';

@Component({
  selector: 'pulpe-add-transaction-bottom-sheet',
  imports: [
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
    AddTransactionForm,
    BlurOnVisibilityResumeDirective,
    LoadingButton,
  ],
  template: `
    <div class="flex flex-col gap-4 pb-6" pulpeBlurOnVisibilityResume>
      <div
        class="w-9 h-1 bg-outline-variant rounded-sm mx-auto mt-3 mb-2"
      ></div>

      <div class="flex justify-between items-center gap-4">
        <div class="min-w-0">
          <h2 class="text-title-large text-on-surface m-0 [text-wrap:balance]">
            {{ 'currentMonth.addTransactionTitle' | transloco }}
          </h2>
          <p
            class="text-body-small text-on-surface-variant mt-0.5 mb-0 text-pretty"
          >
            {{ 'currentMonth.addTransactionSubtitle' | transloco }}
          </p>
        </div>
        <button
          matIconButton
          (click)="close()"
          [attr.aria-label]="'currentMonth.addTransactionClose' | transloco"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <pulpe-add-transaction-form #form (created)="onCreated($event)" />

      <!-- Pinned, because the sheet is taller than a phone: the submit button's
           top edge measured one pixel below the fold on a 812px viewport, and
           the amount field autofocuses, so the keyboard then pushed it a few
           hundred more. The step that commits the money was reachable only by
           guessing the sheet scrolls, which it gives no sign of doing. The
           background matches the sheet's own surface-container-low so the
           form passes under the bar instead of through it; the existing top
           rule doubles as the scroll edge. Desktop uses the dialog, which is
           short enough that this changes nothing there. -->
      <div
        class="sticky bottom-0 flex gap-3 pt-4 pb-2 -mb-2 border-t border-outline-variant bg-surface-container-low"
      >
        <button
          matButton
          (click)="close()"
          class="flex-1"
          data-testid="transaction-cancel-button"
        >
          {{ 'currentMonth.addTransactionCancel' | transloco }}
        </button>
        <pulpe-loading-button
          class="flex-2"
          type="button"
          [loading]="form.isSubmitting()"
          [disabled]="!form.canSubmit()"
          [loadingText]="'common.loading' | transloco"
          (click)="form.submit()"
          testId="transaction-submit-button"
        >
          {{ 'currentMonth.addTransactionSubmit' | transloco }}
        </pulpe-loading-button>
      </div>
    </div>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTransactionBottomSheet {
  readonly #bottomSheetRef = inject(
    MatBottomSheetRef<AddTransactionBottomSheet, TransactionFormData>,
  );

  protected close(): void {
    this.#bottomSheetRef.dismiss();
  }

  protected onCreated(tx: TransactionFormData): void {
    this.#bottomSheetRef.dismiss(tx);
  }
}
