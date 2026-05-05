import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'pulpe-error-alert',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.hidden]': '!message()' },
  template: `
    <div
      class="bg-error-container text-on-error-container p-3 rounded-lg flex items-center gap-2 my-4"
      role="alert"
      aria-atomic="true"
    >
      @if (message()) {
        <mat-icon class="shrink-0">error_outline</mat-icon>
        <span>{{ message() }}</span>
      }
    </div>
  `,
})
export class ErrorAlert {
  readonly message = input<string | null>(null);
}
