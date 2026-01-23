import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'pulpe-default-warning-panel',

  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="p-4 rounded-corner-medium bg-error-container text-on-error-container flex items-center gap-3"
      role="alert"
      aria-live="polite"
      data-testid="default-warning-panel"
    >
      <mat-icon
        class="text-on-secondary-container flex-shrink-0 mt-0.5"
        aria-hidden="true"
      >
        info
      </mat-icon>
      <div class="flex-1">
        <span class="text-body-medium leading-relaxed">
          {{ message() }}
        </span>
      </div>
      @if (dismissable()) {
        <button
          type="button"
          matIconButton
          (click)="onDismiss()"
          aria-label="Fermer l'information"
          class="flex-shrink-0"
          data-testid="dismiss-warning-button"
        >
          <mat-icon>close</mat-icon>
        </button>
      }
    </div>
  `,
})
export class DefaultWarningPanel {
  readonly message = input.required<string>();
  readonly dismissable = input(false);

  readonly dismiss = output<void>();

  protected onDismiss(): void {
    this.dismiss.emit();
  }
}
