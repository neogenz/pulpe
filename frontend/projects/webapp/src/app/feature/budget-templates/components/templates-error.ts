import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'pulpe-templates-error',
  imports: [MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <mat-card
      class="flex flex-col items-center justify-center p-8 text-center"
      data-testid="templates-error-card"
    >
      <mat-icon class="text-error text-5xl mb-4" data-testid="error-icon"
        >error</mat-icon
      >
      <h2 class="text-title-large mb-2" data-testid="error-title">
        Erreur de chargement
      </h2>
      <p
        class="text-body-large text-on-surface-variant mb-4"
        data-testid="error-message"
      >
        Impossible de charger les modèles de budget.
      </p>
      <button mat-button (click)="reload.emit()" data-testid="retry-button">
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplatesError {
  reload = output<void>();
}
