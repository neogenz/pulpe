import {
  ChangeDetectionStrategy,
  Component,
  input,
  computed,
} from '@angular/core';
import { SpinnerComponent } from 'ngx-unicode-spinners';

export type LoadingSize = 'small' | 'medium' | 'large';

@Component({
  selector: 'pulpe-base-loading',

  imports: [SpinnerComponent],
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
        <ngx-unicode-spinners
          name="braille"
          [fontSize]="spinnerFontSize()"
          color="var(--mat-sys-primary)"
          [ariaLabel]="message()"
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
  readonly message = input.required<string>();
  readonly size = input<LoadingSize>('medium');
  readonly testId = input<string>('loading-container');
  readonly fullHeight = input<boolean>(false);

  protected readonly spinnerFontSize = computed(() => {
    switch (this.size()) {
      case 'small':
        return '1.5rem';
      case 'medium':
        return '2rem';
      case 'large':
        return '3rem';
    }
  });

  protected readonly messageId = computed(() => {
    return `loading-message-${this.testId()}`;
  });

  protected readonly actualHeight = computed(() => {
    return this.fullHeight() ? '100vh' : '256px';
  });
}
