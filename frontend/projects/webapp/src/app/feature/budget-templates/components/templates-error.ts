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
import { StateCard } from '@ui/state-card/state-card';

import { type HttpErrorResponse } from '@angular/common/http';

interface ApiErrorDetails {
  readonly statusCode?: number;
  readonly message?: string;
}

interface ApiError {
  readonly status?: number;
  readonly error?: ApiErrorDetails;
  readonly message?: string;
}

type TemplateErrorType = HttpErrorResponse | ApiError | Error | null;

@Component({
  selector: 'pulpe-templates-error',
  imports: [StateCard],
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
        Patiente encore {{ retryCountdown() }} secondes avant de réessayer.
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

  readonly reload = output<void>();
  readonly error = input<TemplateErrorType>();

  readonly retryCountdown = signal(0);
  readonly retryDisabled = computed(() => this.retryCountdown() > 0);

  readonly isRateLimited = computed(() => {
    const err = this.error();
    if (!err) return false;

    // Check for HttpErrorResponse
    if ('status' in err && err.status === 429) {
      return true;
    }

    // Check for ApiError with nested error object
    if (
      'error' in err &&
      err.error &&
      'statusCode' in err.error &&
      err.error.statusCode === 429
    ) {
      return true;
    }

    return false;
  });

  readonly errorTitle = computed(() => {
    return this.isRateLimited()
      ? 'Trop de requêtes pour le moment'
      : 'Impossible de charger tes modèles';
  });

  readonly errorMessage = computed(() => {
    if (this.isRateLimited()) {
      return 'Le serveur est temporairement surchargé — réessaie dans un instant';
    }
    return 'Le chargement des modèles a échoué. Réessaie pour continuer.';
  });

  readonly retryButtonLabel = computed(() => {
    return this.retryDisabled() ? 'Patienter...' : 'Réessayer';
  });

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
