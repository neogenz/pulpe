import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { StateCard } from '@ui/state-card/state-card';

@Component({
  selector: 'pulpe-months-error',
  imports: [StateCard, TranslocoPipe],
  template: `
    <pulpe-state-card
      variant="error"
      [title]="'budget.loadBudgetsError' | transloco"
      [message]="'budget.loadBudgetsMessage' | transloco"
      [actionLabel]="'common.retry' | transloco"
      testId="months-error-card"
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
export class MonthsError {
  reload = output<void>();
}
