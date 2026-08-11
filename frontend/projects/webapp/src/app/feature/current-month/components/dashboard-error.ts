import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
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
      [message]="message()"
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
  // The card used to hardcode a sentence about the connection. The failure it
  // renders already knows what it was — a refused request, a payload the
  // client no longer understands, a rate limit — and the store now names it.
  readonly message = input.required<string>();
  reload = output<void>();
}
