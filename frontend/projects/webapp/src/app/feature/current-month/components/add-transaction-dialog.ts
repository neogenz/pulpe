import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, merge } from 'rxjs';

import { LoadingButton } from '@ui/loading-button/loading-button';
import {
  AddTransactionForm,
  type TransactionFormData,
} from './add-transaction-form';
import type { AddTransactionShellData } from './add-transaction-shell-data';

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
      [disabled]="isPersisting()"
      [attr.aria-label]="'currentMonth.addTransactionClose' | transloco"
    >
      <mat-icon>close</mat-icon>
    </button>
    <h2
      mat-dialog-title
      class="text-headline-small text-on-surface pr-20! [text-wrap:balance]"
    >
      {{
        'currentMonth.addTransactionTitle'
          | transloco
            : { nature: 'transactionKindIndefinite.' + form.kind() | transloco }
      }}
    </h2>

    <mat-dialog-content>
      <pulpe-add-transaction-form
        #form
        class="add-transaction-form-wide block"
        (created)="onCreated($event)"
      />
    </mat-dialog-content>

    <!-- Beside the form it refers to, not in a toast: the dialog is still up
         and still holds the amount, the label and the tags, so retrying is one
         press away rather than a full retype. -->
    @if (refusal()) {
      <p
        class="text-body-small text-error px-6 pb-2 m-0 flex items-start gap-2"
        role="alert"
        data-testid="transaction-refusal"
      >
        <mat-icon class="mat-icon-sm shrink-0" aria-hidden="true"
          >error</mat-icon
        >
        {{ refusal() }}
      </p>
    }

    <mat-dialog-actions align="end">
      <button
        matButton
        (click)="close()"
        [disabled]="isPersisting()"
        data-testid="transaction-cancel-button"
      >
        {{ 'currentMonth.addTransactionCancel' | transloco }}
      </button>
      <pulpe-loading-button
        class="min-w-40"
        type="button"
        [fullWidth]="false"
        [loading]="form.isSubmitting() || isPersisting()"
        [disabled]="!form.canSubmit() || isPersisting()"
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
  readonly #data = inject<AddTransactionShellData>(MAT_DIALOG_DATA);
  private readonly formRef = viewChild.required(AddTransactionForm);

  // The dialog holds the only copy of what was typed, so it stays up until the
  // write is accepted. `isSubmitting` on the form ends at the built payload,
  // which is why the button stopped spinning while the request was still out.
  protected readonly isPersisting = signal(false);
  protected readonly refusal = signal('');

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
    // L'écriture est déjà partie : fermer maintenant n'annule rien, cela cache
    // seulement une écriture qui va atterrir quand même — l'utilisateur croit
    // avoir renoncé et retrouve son montant enregistré. Les quatre sorties
    // passent par ici, ce seul garde les couvre donc toutes.
    if (this.isPersisting()) return;
    if (this.formRef().hasInput() && !(await this.#data.confirmDiscard()))
      return;
    this.#dialogRef.close();
  }

  protected async onCreated(tx: TransactionFormData): Promise<void> {
    this.refusal.set('');
    this.isPersisting.set(true);
    try {
      const refusal = await this.#data.persist(tx);
      if (refusal) {
        this.refusal.set(refusal);
        return;
      }
      this.#dialogRef.close(tx);
    } finally {
      this.isPersisting.set(false);
    }
  }
}
