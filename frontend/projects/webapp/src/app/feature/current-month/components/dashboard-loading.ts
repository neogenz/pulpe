import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'pulpe-dashboard-loading',
  imports: [MatProgressSpinnerModule],
  template: `
    <div
      class="flex justify-center items-center h-64"
      data-testid="dashboard-loading-container"
    >
      <div class="text-center flex flex-col gap-4 justify-center items-center">
        <mat-progress-spinner
          diameter="48"
          mode="indeterminate"
          data-testid="loading-spinner"
        />
        <p
          class="text-body-large text-on-surface-variant"
          data-testid="loading-message"
        >
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
