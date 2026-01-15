import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'pulpe-maintenance-page',
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="min-h-screen pulpe-gradient flex items-center justify-center p-4"
    >
      <div
        class="w-full max-w-lg bg-surface rounded-2xl p-8 md:p-12 flex flex-col items-center gap-6 text-center"
      >
        <mat-icon class="text-primary !w-16 !h-16 !text-[64px]">
          engineering
        </mat-icon>

        <h1 class="text-headline-large text-on-surface">
          Maintenance en cours
        </h1>

        <p class="text-body-large text-on-surface-variant">
          L'application est temporairement indisponible pour maintenance.
          Veuillez réessayer dans quelques instants.
        </p>

        <button
          mat-flat-button
          class="mt-4"
          (click)="reload()"
          data-testid="maintenance-reload-button"
        >
          <mat-icon>refresh</mat-icon>
          Réessayer
        </button>
      </div>
    </div>
  `,
})
export default class MaintenancePage {
  reload(): void {
    window.location.href = '/';
  }
}
