import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'pulpe-templates-error',
  imports: [MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <mat-card class="flex flex-col items-center justify-center p-8 text-center">
      <mat-icon class="text-error text-5xl mb-4">error</mat-icon>
      <h2 class="text-title-large mb-2">Erreur de chargement</h2>
      <p class="text-body-large text-on-surface-variant mb-4">
        Impossible de charger les modèles de budget.
      </p>
      <button mat-button (click)="reload.emit()">
        <mat-icon>refresh</mat-icon>
        Réessayer
      </button>
    </mat-card>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TemplatesError {
  reload = output<void>();
}
