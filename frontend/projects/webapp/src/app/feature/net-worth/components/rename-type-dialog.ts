import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';

export interface RenameTypeDialogData {
  name: string;
}

export const MAX_TYPE_NAME_LENGTH = 30;

/** Closes with the new name of a Type, only when it changed. */
@Component({
  selector: 'pulpe-rename-type-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    TranslocoPipe,
  ],
  host: { 'data-testid': 'rename-type-dialog' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      {{ 'netWorth.type.rename' | transloco }}
    </h2>
    <mat-dialog-content>
      <mat-form-field
        appearance="outline"
        subscriptSizing="dynamic"
        class="mt-2 w-full"
      >
        <mat-label>{{ 'netWorth.type.nameLabel' | transloco }}</mat-label>
        <input
          matInput
          cdkFocusInitial
          class="ph-no-capture"
          [maxlength]="maxLength"
          [ngModel]="name()"
          (ngModelChange)="name.set($event)"
          (keydown.enter)="submit()"
          data-testid="rename-type-input"
        />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end" class="gap-2">
      <button
        matButton
        mat-dialog-close
        data-testid="rename-type-cancel-button"
      >
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        matButton="filled"
        [disabled]="!canSubmit()"
        (click)="submit()"
        data-testid="rename-type-submit-button"
      >
        {{ 'common.save' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
})
export class RenameTypeDialog {
  readonly #dialogRef = inject(MatDialogRef<RenameTypeDialog, string>);
  readonly #original = inject<RenameTypeDialogData>(MAT_DIALOG_DATA).name;

  protected readonly maxLength = MAX_TYPE_NAME_LENGTH;
  protected readonly name = signal(this.#original);
  protected readonly canSubmit = computed(() => {
    const name = this.name().trim();
    return name !== '' && name !== this.#original;
  });

  protected submit(): void {
    if (this.canSubmit()) this.#dialogRef.close(this.name().trim());
  }
}
