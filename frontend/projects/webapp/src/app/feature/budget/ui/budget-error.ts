import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'pulpe-months-error',
  imports: [MatCardModule, MatIconModule, MatButtonModule],
  template: `
    <div class="flex flex-col items-center justify-center">
      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>
            <div class="flex items-center justify-center gap-2">
              <mat-icon>error_outline</mat-icon>
              Impossible de charger vos mois
            </div>
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p class="pt-4">
            Une erreur s'est produite lors du chargement de vos mois
            budgétaires. Vos données sont en sécurité.
          </p>
        </mat-card-content>
        <mat-card-actions align="end">
          <button (click)="reload.emit()" matButton>Réessayer</button>
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
export class MonthsError {
  reload = output<void>();
}
