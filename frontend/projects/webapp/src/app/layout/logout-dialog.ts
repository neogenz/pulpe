import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'pulpe-logout-dialog',
  imports: [MatDialogModule, MatProgressSpinnerModule],
  template: `
    <div class="flex flex-col items-center justify-center p-8 min-w-64">
      <mat-spinner diameter="48" />
      <p class="mt-6 text-on-surface text-title-medium">Déconnexion en cours</p>
      <p class="mt-1 text-on-surface-variant text-body-small">
        Veuillez patienter...
      </p>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoutDialog {}
