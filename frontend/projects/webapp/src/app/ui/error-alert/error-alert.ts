import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'pulpe-error-alert',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message()) {
      <div
        class="bg-error-container text-on-error-container p-3 rounded-lg flex items-center gap-2"
        role="alert"
      >
        <mat-icon class="flex-shrink-0">error_outline</mat-icon>
        <span>{{ message() }}</span>
      </div>
    }
  `,
})
export class ErrorAlert {
  readonly message = input<string | null>(null);
}
