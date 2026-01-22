import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'pulpe-logout-dialog',
  imports: [MatDialogModule, MatProgressSpinnerModule],
  template: `
    <mat-dialog-content class="flex flex-col items-center justify-center py-8">
      <mat-spinner diameter="48" />
      <p class="mt-4 text-on-surface-variant text-body-large">Déconnexion...</p>
    </mat-dialog-content>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      mat-dialog-content {
        min-width: 200px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoutDialog {}
