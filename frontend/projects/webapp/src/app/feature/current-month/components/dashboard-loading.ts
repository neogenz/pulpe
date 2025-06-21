import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'pulpe-dashboard-loading',
  imports: [MatProgressSpinnerModule],
  template: `
    <div class="flex justify-center items-center h-64">
      <div class="text-center flex flex-col gap-4 justify-center items-center">
        <mat-progress-spinner diameter="48" mode="indeterminate" />
        <p class="text-body-large text-on-surface-variant">
          Chargement du budget...
        </p>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardLoading {}
