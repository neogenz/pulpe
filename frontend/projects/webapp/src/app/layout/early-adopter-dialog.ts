import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'pulpe-early-adopter-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, TranslocoPipe],
  template: `
    <div class="flex flex-col items-center gap-4 p-6">
      <div class="early-adopter-icon">
        <mat-icon>auto_awesome</mat-icon>
      </div>

      <h2 class="text-headline-small text-center">
        {{ 'earlyAdopter.title' | transloco }}
      </h2>

      <p class="text-body-medium text-on-surface-variant text-center max-w-xs">
        {{ 'earlyAdopter.message' | transloco }}
      </p>

      <p
        class="text-body-small text-on-surface-variant/70 text-center italic max-w-xs"
      >
        {{ 'earlyAdopter.signature' | transloco }}
      </p>

      <button
        matButton="tonal"
        (click)="close()"
        data-testid="early-adopter-close-button"
      >
        {{ 'earlyAdopter.close' | transloco }}
      </button>
    </div>
  `,
  styles: `
    .early-adopter-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: linear-gradient(
        135deg,
        #fff8e1 0%,
        #ffecb3 50%,
        #ffe082 100%
      );
      border: 2px solid #ffd54f;
      box-shadow: 0 4px 16px -4px rgba(255, 193, 7, 0.4);
    }

    .early-adopter-icon mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #f57f17;
    }

    :host-context(.dark-theme) .early-adopter-icon {
      background: linear-gradient(
        135deg,
        rgba(255, 193, 7, 0.1) 0%,
        rgba(255, 193, 7, 0.2) 100%
      );
      border-color: rgba(255, 193, 7, 0.3);
      box-shadow: 0 4px 16px -4px rgba(0, 0, 0, 0.5);
    }

    :host-context(.dark-theme) .early-adopter-icon mat-icon {
      color: #ffca28;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EarlyAdopterDialog {
  readonly #dialogRef = inject(MatDialogRef<EarlyAdopterDialog>);

  protected close(): void {
    this.#dialogRef.close();
  }
}
