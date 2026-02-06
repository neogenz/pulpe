import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { StateCard } from '@ui/state-card/state-card';

@Component({
  selector: 'pulpe-dashboard-error',
  imports: [StateCard],
  template: `
    <pulpe-state-card
      data-testid="dashboard-error-container"
      testId="dashboard-error-container"
      variant="error"
      title="On n'arrive pas à charger ton tableau de bord"
      message="Ta connexion a peut-être coupé. Réessaie pour récupérer tes données."
      actionLabel="Réessayer"
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
