import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'pulpe-dashboard-error',
  imports: [MatCardModule, MatIconModule, MatButtonModule],
  template: `
    <div
      class="flex flex-col items-center justify-center"
      data-testid="dashboard-error-container"
    >
      <mat-card appearance="outlined" data-testid="error-card">
        <mat-card-header>
          <mat-card-title>
            <div
              class="flex items-center justify-center gap-2"
              data-testid="error-title"
            >
              <mat-icon data-testid="error-icon">error_outline</mat-icon>
              Impossible de charger vos données
            </div>
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p class="pt-4" data-testid="error-message">
            Une erreur s'est produite lors du chargement de vos informations
            budgétaires. Vos données sont en sécurité.
          </p>
        </mat-card-content>
        <mat-card-actions align="end">
          <button (click)="reload.emit()" matButton data-testid="retry-button">
            Réessayer
          </button>
        </mat-card-actions>
      </mat-card>
    </div>
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
