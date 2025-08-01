import {
  ChangeDetectionStrategy,
  Component,
  input,
  computed,
} from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export type LoadingSize =
  | 'small'
  | 'medium'
  | 'default'
  | 'large'
  | 'extra-large';

export type LoadingVariant = 'spinner' | 'skeleton' | 'shimmer';

export type LoadingSurface =
  | 'surface'
  | 'surface-container'
  | 'surface-container-low'
  | 'surface-container-high'
  | 'surface-container-highest';

@Component({
  selector: 'pulpe-base-loading',
  standalone: true,
  imports: [MatProgressSpinnerModule],
  template: `
    <div
      class="flex justify-center items-center transition-colors duration-200"
      [class]="containerSurfaceClass()"
      [style.height]="actualHeight()"
      role="status"
      aria-live="polite"
      [attr.data-testid]="testId()"
      [attr.aria-describedby]="hideMessage() ? null : messageId()"
    >
      <div
        class="text-center flex flex-col justify-center items-center"
        [class.gap-4]="!hideMessage()"
      >
        <mat-progress-spinner
          [diameter]="spinnerDiameter()"
          mode="indeterminate"
          [attr.aria-label]="message()"
          role="progressbar"
          class="pulpe-loading-indicator"
          [class]="spinnerSizeClass()"
          data-testid="loading-spinner"
        />
        @if (!hideMessage()) {
          <p
            class="text-body-large text-on-surface-variant mt-4 animate-fadeIn"
            aria-live="polite"
            data-testid="loading-message"
            [id]="messageId()"
          >
            {{ message() }}
          </p>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BaseLoadingComponent {
  message = input.required<string>();
  size = input<LoadingSize>('default');
  variant = input<LoadingVariant>('spinner');
  surface = input<LoadingSurface>('surface-container');
  containerHeight = input<number>(256);
  testId = input<string>('loading-container');
  hideMessage = input<boolean>(false);
  fullHeight = input<boolean>(false);

  protected spinnerDiameter = computed(() => {
    switch (this.size()) {
      case 'small':
        return 24;
      case 'medium':
        return 32;
      case 'default':
        return 40;
      case 'large':
        return 48;
      case 'extra-large':
        return 56;
      default:
        return 40;
    }
  });

  protected spinnerSizeClass = computed(() => {
    return `pulpe-loading-${this.size()}`;
  });

  protected messageId = computed(() => {
    return `loading-message-${this.testId()}`;
  });

  protected containerSurfaceClass = computed(() => {
    const surface = this.surface();
    switch (surface) {
      case 'surface':
        return 'bg-surface';
      case 'surface-container':
        return 'loading-surface-container';
      case 'surface-container-low':
        return 'loading-surface-container-low';
      case 'surface-container-high':
        return 'loading-surface-container-high';
      case 'surface-container-highest':
        return 'loading-surface-container-highest';
      default:
        return 'loading-surface-container';
    }
  });

  protected actualHeight = computed(() => {
    return this.fullHeight() ? '100vh' : `${this.containerHeight()}px`;
  });
}
