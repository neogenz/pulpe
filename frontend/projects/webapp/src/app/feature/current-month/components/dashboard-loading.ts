import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BaseLoadingComponent } from '../../../ui/loading/base-loading.component';

@Component({
  selector: 'pulpe-dashboard-loading',
  imports: [BaseLoadingComponent],
  template: `
    <pulpe-base-loading
      message="Chargement du tableau de bord..."
      size="large"
      [containerHeight]="256"
      testId="dashboard-loading-container"
    />
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardLoading {}
