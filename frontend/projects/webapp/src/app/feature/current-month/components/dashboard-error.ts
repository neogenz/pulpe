import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { StateCard } from '@ui/state-card/state-card';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'pulpe-dashboard-error',
  imports: [StateCard, TranslocoPipe],
  template: `
    <pulpe-state-card
      data-testid="dashboard-error-container"
      testId="dashboard-error-container"
      variant="error"
      [title]="'currentMonth.loadErrorTitle' | transloco"
      [message]="'currentMonth.loadErrorMessage' | transloco"
      [actionLabel]="'common.retry' | transloco"
      (action)="reload.emit()"
    />
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardError {
  reload = output<void>();
}
