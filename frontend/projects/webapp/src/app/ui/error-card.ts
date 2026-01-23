import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'pulpe-error-card',
  imports: [MatCardModule],
  template: `
    <div class="mt-8">
      <mat-card appearance="outlined" class="text-on-error-container">
        <mat-card-header>
          <mat-card-title>Erreur</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          {{ error() }}
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      @use '@angular/material' as mat;

      :host {
        display: block;

        @include mat.card-overrides(
          (
            outlined-container-color: var(--mat-sys-error-container),
            outlined-outline-color: var(--mat-sys-error),
            subtitle-text-color: var(--mat-sys-on-error-container),
          )
        );
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorCard {
  readonly error = input.required<string>();
}
