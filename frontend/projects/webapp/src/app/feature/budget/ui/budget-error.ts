import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { StateCard } from '@ui/state-card/state-card';

@Component({
  selector: 'pulpe-months-error',
  imports: [StateCard],
  template: `
    <pulpe-state-card
      variant="error"
      title="Impossible de charger tes budgets"
      message="Le chargement a bloqué. Réessaie pour afficher tes mois."
      actionLabel="Réessayer"
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
