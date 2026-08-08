import {
  ChangeDetectionStrategy,
  Component,
  inject,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, merge } from 'rxjs';

import { LoadingButton } from '@ui/loading-button/loading-button';
import { AddTransactionDialogService } from '../services/add-transaction-dialog.service';
import {
  AddTransactionForm,
  type TransactionFormData,
} from './add-transaction-form';

@Component({
  selector: 'pulpe-add-transaction-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    TranslocoPipe,
    AddTransactionForm,
    LoadingButton,
  ],
  template: `
    <button
      matIconButton
      class="absolute! top-3 right-3 z-10"
      (click)="close()"
      [attr.aria-label]="'currentMonth.addTransactionClose' | transloco"
    >
      <mat-icon>close</mat-icon>
    </button>
    <h2
      mat-dialog-title
      class="text-headline-small text-on-surface pr-20! [text-wrap:balance]"
    >
      {{ 'currentMonth.addTransactionTitle' | transloco }}
    </h2>

    <mat-dialog-content>
      <p class="text-body-small text-on-surface-variant mt-0 mb-4 text-pretty">
        {{ 'currentMonth.addTransactionSubtitle' | transloco }}
      </p>
      <pulpe-add-transaction-form
        #form
        class="add-transaction-form-wide block"
        (created)="onCreated($event)"
      />
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button
        matButton
        (click)="close()"
        data-testid="transaction-cancel-button"
      >
        {{ 'currentMonth.addTransactionCancel' | transloco }}
      </button>
      <pulpe-loading-button
        class="min-w-40"
        type="button"
        [fullWidth]="false"
        [loading]="form.isSubmitting()"
        [disabled]="!form.canSubmit()"
        [loadingText]="'common.loading' | transloco"
        (click)="form.submit()"
        testId="transaction-submit-button"
      >
        {{ 'currentMonth.addTransactionSubmit' | transloco }}
      </pulpe-loading-button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTransactionDialog {
  readonly #dialogRef = inject(
    MatDialogRef<AddTransactionDialog, TransactionFormData>,
  );
  readonly #dialogService = inject(AddTransactionDialogService);
  private readonly formRef = viewChild.required(AddTransactionForm);

  constructor() {
    // Toutes les sorties passent maintenant par `close()` : la croix, Annuler,
    // le clic hors cadre et Échap. C'est la seule façon d'avoir un garde-fou
    // unique — un par sortie en laisse toujours une sans.
    merge(
      this.#dialogRef.backdropClick(),
      this.#dialogRef
        .keydownEvents()
        .pipe(filter((event) => event.key === 'Escape')),
    )
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.close());
  }

  protected async close(): Promise<void> {
    if (
      this.formRef().hasInput() &&
      !(await this.#dialogService.confirmDiscard())
    )
      return;
    this.#dialogRef.close();
  }

  protected onCreated(tx: TransactionFormData): void {
    this.#dialogRef.close(tx);
  }
}
