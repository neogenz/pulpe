import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { TranslocoPipe } from '@jsverse/transloco';

export type TemplatePropagationChoice = 'template-only' | 'propagate';

interface TemplatePropagationDialogData {
  templateName: string;
}

@Component({
  selector: 'pulpe-template-propagation-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatRadioModule,
    MatIconModule,
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title class="flex! gap-2 items-center pt-6!">
      <mat-icon>tune</mat-icon>
      <span>{{ 'template.propagationTitle' | transloco }}</span>
    </h2>

    <mat-dialog-content class="flex flex-col gap-4">
      <p class="text-body-medium">
        {{ 'template.propagationIntro' | transloco }}
        <strong class="ph-no-capture">{{ data.templateName }}</strong
        >.
      </p>

      <mat-radio-group
        [value]="selectedMode()"
        (change)="onSelectionChange($event.value)"
        class="flex flex-col gap-3"
        [attr.aria-label]="'template.propagateRadioLabel' | transloco"
      >
        <mat-radio-button value="template-only">
          <div class="flex flex-col">
            <span class="text-title-medium">{{
              'template.templateOnly' | transloco
            }}</span>
            <span class="text-body-small text-on-surface-variant">
              {{ 'template.templateOnlyDesc' | transloco }}
            </span>
          </div>
        </mat-radio-button>

        <mat-radio-button value="propagate">
          <div class="flex flex-col">
            <span class="text-title-medium">{{
              'template.propagateAll' | transloco
            }}</span>
            <span class="text-body-small text-on-surface-variant">
              {{ 'template.propagateAllDesc' | transloco }}
            </span>
          </div>
        </mat-radio-button>
      </mat-radio-group>

      @if (selectedMode() === 'propagate') {
        <div
          class="grid grid-cols-[auto_1fr] gap-2 p-3 bg-tertiary-container text-on-tertiary-container! rounded-xl mt-3"
        >
          <div class="flex items-center">
            <mat-icon class="">info</mat-icon>
          </div>
          <div>
            <p class="text-body-small">
              {{ 'template.propagateNote' | transloco }}
            </p>
          </div>
        </div>
      }

      <p class="text-body-small text-outline mt-2">
        {{ 'template.propagateFooter' | transloco }}
      </p>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton (click)="cancel()">
        {{ 'common.cancel' | transloco }}
      </button>
      <button matButton="filled" color="primary" (click)="confirm()">
        {{ 'common.continue' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-radio-button {
      padding: 0.75rem;
      border-radius: 0.75rem;
      transition: background-color 0.2s ease;
    }

    mat-radio-button:hover {
      background-color: var(--mat-sys-surface-container-highest);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplatePropagationDialog {
  readonly #dialogRef = inject(
    MatDialogRef<TemplatePropagationDialog, TemplatePropagationChoice | null>,
  );
  readonly data = inject<TemplatePropagationDialogData>(MAT_DIALOG_DATA);

  readonly selectedMode = signal<TemplatePropagationChoice>('template-only');

  onSelectionChange(choice: TemplatePropagationChoice): void {
    this.selectedMode.set(choice);
  }

  cancel(): void {
    this.#dialogRef.close(null);
  }

  confirm(): void {
    this.#dialogRef.close(this.selectedMode());
  }
}
