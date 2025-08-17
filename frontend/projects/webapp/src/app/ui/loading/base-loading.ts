import {
  ChangeDetectionStrategy,
  Component,
  input,
  computed,
} from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export type LoadingSize = 'small' | 'medium' | 'large';

@Component({
  selector: 'pulpe-base-loading',
  standalone: true,
  imports: [MatProgressSpinnerModule],
  template: `
    <div
      class="flex justify-center items-center"
      [style.height]="actualHeight()"
      role="status"
      aria-live="polite"
      [attr.data-testid]="testId()"
      [attr.aria-describedby]="messageId()"
    >
      <div class="text-center flex flex-col justify-center items-center gap-4">
        <mat-progress-spinner
          [diameter]="spinnerDiameter()"
          mode="indeterminate"
          [attr.aria-label]="message()"
          role="progressbar"
          class="pulpe-loading-indicator"
          [class]="spinnerSizeClass()"
          data-testid="loading-spinner"
        />
        <p
          class="text-body-large text-on-surface-variant"
          aria-live="polite"
          data-testid="loading-message"
          [id]="messageId()"
        >
          {{ message() }}
        </p>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BaseLoading {
  message = input.required<string>();
  size = input<LoadingSize>('medium');
  testId = input<string>('loading-container');
  fullHeight = input<boolean>(false);

  protected spinnerDiameter = computed(() => {
    switch (this.size()) {
      case 'small':
        return 24;
      case 'medium':
        return 32;
      case 'large':
        return 48;
      default:
        return 32;
    }
  });

  protected spinnerSizeClass = computed(() => {
    return `pulpe-loading-${this.size()}`;
  });

  protected messageId = computed(() => {
    return `loading-message-${this.testId()}`;
  });

  protected actualHeight = computed(() => {
    return this.fullHeight() ? '100vh' : '256px';
  });
}
