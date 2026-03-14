import {
  ChangeDetectionStrategy,
  Component,
  output,
  input,
  computed,
  signal,
  effect,
  DestroyRef,
  inject,
} from '@angular/core';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { StateCard } from '@ui/state-card/state-card';

interface ApiErrorDetails {
  readonly statusCode?: number;
  readonly message?: string;
}

interface ApiError {
  readonly status?: number;
  readonly error?: ApiErrorDetails;
  readonly message?: string;
}

@Component({
  selector: 'pulpe-templates-error',
  imports: [StateCard, TranslocoPipe],
  template: `
    <pulpe-state-card
      testId="templates-error-card"
      variant="error"
      [title]="errorTitle()"
      [message]="errorMessage()"
      [actionLabel]="retryButtonLabel()"
      [actionDisabled]="retryDisabled()"
      (action)="handleRetry()"
    />

    @if (isRateLimited()) {
      <p class="text-body-medium text-on-surface-variant mt-4 text-center">
        {{
          'template.rateLimitCountdown'
            | transloco: { seconds: retryCountdown() }
        }}
      </p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplatesError {
  readonly #destroyRef = inject(DestroyRef);
  readonly #transloco = inject(TranslocoService);

  readonly reload = output<void>();
  readonly error = input<unknown>();

  readonly retryCountdown = signal(0);
  readonly retryDisabled = computed(() => this.retryCountdown() > 0);

  readonly isRateLimited = computed(() => {
    const err = this.error();
    if (!err || typeof err !== 'object') return false;

    // Check for HttpErrorResponse
    if ('status' in err && (err as ApiError).status === 429) {
      return true;
    }

    // Check for ApiError with nested error object
    const apiErr = err as ApiError;
    if (
      apiErr.error &&
      'statusCode' in apiErr.error &&
      apiErr.error.statusCode === 429
    ) {
      return true;
    }

    return false;
  });

  readonly #rateLimitTitle = this.#transloco.translate(
    'template.rateLimitTitle',
  );
  readonly #loadFailTitle = this.#transloco.translate('template.loadFailTitle');
  readonly #rateLimitMessage = this.#transloco.translate(
    'template.rateLimitMessage',
  );
  readonly #loadFailMessage = this.#transloco.translate(
    'template.loadFailMessage',
  );
  readonly #retryWaitLabel = this.#transloco.translate('template.retryWait');
  readonly #retryLabel = this.#transloco.translate('common.retry');

  readonly errorTitle = computed(() =>
    this.isRateLimited() ? this.#rateLimitTitle : this.#loadFailTitle,
  );

  readonly errorMessage = computed(() =>
    this.isRateLimited() ? this.#rateLimitMessage : this.#loadFailMessage,
  );

  readonly retryButtonLabel = computed(() =>
    this.retryDisabled() ? this.#retryWaitLabel : this.#retryLabel,
  );

  #currentIntervalId: number | null = null;

  constructor() {
    // Track when rate limited state changes to manage countdown
    effect(() => {
      if (this.isRateLimited()) {
        this.#startCountdownIfNeeded();
      } else {
        this.#clearCountdown();
      }
    });
  }

  #startCountdownIfNeeded(): void {
    // Only start countdown if not already running and countdown is 0
    if (this.#currentIntervalId === null && this.retryCountdown() === 0) {
      this.retryCountdown.set(30);
      this.#startCountdown();
    }
  }

  #startCountdown(): void {
    this.#clearCountdown(); // Ensure no existing interval

    this.#currentIntervalId = window.setInterval(() => {
      const current = this.retryCountdown();
      if (current > 0) {
        this.retryCountdown.set(current - 1);
      } else {
        this.#clearCountdown();
      }
    }, 1000);

    // Cleanup on destroy
    this.#destroyRef.onDestroy(() => {
      this.#clearCountdown();
    });
  }

  #clearCountdown(): void {
    if (this.#currentIntervalId !== null) {
      clearInterval(this.#currentIntervalId);
      this.#currentIntervalId = null;
    }
  }

  handleRetry(): void {
    if (!this.retryDisabled()) {
      this.reload.emit();

      // Reset countdown if rate limited
      if (this.isRateLimited()) {
        this.retryCountdown.set(0); // Reset to 0 to trigger new countdown
      }
    }
  }
}
