import {
  ChangeDetectionStrategy,
  Component,
  output,
  input,
  computed,
  signal,
  effect,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';

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
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <mat-card
      class="flex flex-col items-center justify-center p-8 text-center"
      data-testid="templates-error-card"
    >
      <mat-icon class="text-error text-5xl mb-4" data-testid="error-icon">{{
        errorIcon()
      }}</mat-icon>
      <h2 class="text-title-large mb-2" data-testid="error-title">
        {{ errorTitle() }}
      </h2>
      <p
        class="text-body-large text-on-surface-variant mb-4"
        data-testid="error-message"
      >
        {{ errorMessage() }}
      </p>
      @if (isRateLimited()) {
        <p class="text-body-medium text-on-surface-variant mb-4">
          Veuillez patienter {{ retryCountdown() }} secondes avant de réessayer.
        </p>
      }
      <button
        matButton
        (click)="handleRetry()"
        [disabled]="retryDisabled()"
        data-testid="retry-button"
      >
        <mat-icon>refresh</mat-icon>
        {{ retryButtonLabel() }}
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
  error = input<TemplateErrorType>();

  retryCountdown = signal(0);
  retryDisabled = computed(() => this.retryCountdown() > 0);

  isRateLimited = computed(() => {
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

  errorIcon = computed(() => {
    return this.isRateLimited() ? 'schedule' : 'error';
  });

  errorTitle = computed(() => {
    return this.isRateLimited() ? 'Trop de requêtes' : 'Erreur de chargement';
  });

  errorMessage = computed(() => {
    if (this.isRateLimited()) {
      return 'Le serveur a reçu trop de requêtes. Veuillez patienter un instant.';
    }
    return 'Impossible de charger les modèles de budget.';
  });

  retryButtonLabel = computed(() => {
    return this.retryDisabled() ? 'Patienter...' : 'Réessayer';
  });

  constructor() {
    // Start countdown when rate limited
    effect(() => {
      if (this.isRateLimited() && this.retryCountdown() === 0) {
        this.retryCountdown.set(30); // 30 seconds countdown
        this.#startCountdown();
      }
    });
  }

  #startCountdown(): void {
    const interval = setInterval(() => {
      const current = this.retryCountdown();
      if (current > 0) {
        this.retryCountdown.set(current - 1);
      } else {
        clearInterval(interval);
      }
    }, 1000);
  }

  handleRetry(): void {
    if (!this.retryDisabled()) {
      this.reload.emit();
      // Reset countdown if rate limited
      if (this.isRateLimited()) {
        this.retryCountdown.set(30);
        this.#startCountdown();
      }
    }
  }
}
