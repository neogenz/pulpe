import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'pulpe-logout-dialog',
  imports: [MatDialogModule, MatProgressSpinnerModule, TranslocoPipe],
  template: `
    <div class="flex flex-col items-center justify-center p-8 min-w-64">
      <mat-spinner diameter="48" />
      <p class="mt-6 text-on-surface text-title-medium">
        {{ 'logout.inProgress' | transloco }}
      </p>
      <p class="mt-1 text-on-surface-variant text-body-small">
        {{ 'logout.seeYouSoon' | transloco }}
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
