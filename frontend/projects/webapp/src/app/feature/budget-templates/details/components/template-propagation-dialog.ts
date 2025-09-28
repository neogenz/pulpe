import { CommonModule } from '@angular/common';
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

export type TemplatePropagationChoice = 'template-only' | 'propagate';

interface TemplatePropagationDialogData {
  templateName: string;
}

@Component({
  selector: 'pulpe-template-propagation-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatRadioModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title class="flex! gap-2 items-center pt-6!">
      <mat-icon>tune</mat-icon>
      <span>Comment appliquer ces modifications ?</span>
    </h2>

    <mat-dialog-content class="flex flex-col gap-4">
      <p class="text-body-medium">
        Vous modifiez le modèle
        <strong class="ph-no-capture">{{ data.templateName }}</strong
        >. Choisissez comment ces changements doivent s'appliquer.
      </p>

      <mat-radio-group
        [value]="selectedMode()"
        (change)="onSelectionChange($event.value)"
        class="flex flex-col gap-3"
        aria-label="Options de propagation"
      >
        <mat-radio-button value="template-only">
          <div class="flex flex-col">
            <span class="text-title-medium"
              >Mettre à jour uniquement le modèle</span
            >
            <span class="text-body-small text-on-surface-variant">
              Les budgets existants ne changent pas. Idéal pour préparer les
              prochains mois sans impacter ceux déjà planifiés.
            </span>
          </div>
        </mat-radio-button>

        <mat-radio-button value="propagate">
          <div class="flex flex-col">
            <span class="text-title-medium">
              Mettre à jour le modèle et les budgets actuels et futurs
            </span>
            <span class="text-body-small text-on-surface-variant">
              Les budgets à partir du mois en cours seront ajustés
              automatiquement (mois passés inchangés).
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
              <strong>Note :</strong> Les saisies modifiées manuellement
              (marquées avec
              <mat-icon class="text-sm! h-[auto]! w-[auto]! align-text-bottom"
                >lock</mat-icon
              >) sont protégées et ne seront pas affectées par la propagation.
              Seules les lignes non modifiées seront automatiquement mises à
              jour.
            </p>
          </div>
        </div>
      }

      <p class="text-body-small text-outline mt-2">
        Vous pourrez toujours ajuster un budget mensuel manuellement après coup.
      </p>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton (click)="cancel()">Annuler</button>
      <button matButton="filled" color="primary" (click)="confirm()">
        Continuer
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
