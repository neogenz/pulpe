import {
  Component,
  ChangeDetectionStrategy,
  signal,
  input,
  output,
  inject,
  type OnDestroy,
  effect,
  contentChild,
  type TemplateRef,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { ErrorManager } from '@core/error/error-manager';
import { type PulpeError, ErrorCategory } from '@core/error/error-types';

/**
 * Error Boundary Component
 * Provides error handling UI wrapper for child components
 *
 * Usage:
 * <pulpe-error-boundary (retry)="loadData()">
 *   <your-component />
 * </pulpe-error-boundary>
 *
 * With custom error template:
 * <pulpe-error-boundary>
 *   <your-component />
 *   <ng-template #errorTemplate let-error="error" let-retry="retry">
 *     <custom-error-ui [error]="error" (retry)="retry()" />
 *   </ng-template>
 * </pulpe-error-boundary>
 */
@Component({
  selector: 'pulpe-error-boundary',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    @if (error()) {
      @if (customErrorTemplate()) {
        <ng-container
          *ngTemplateOutlet="
            customErrorTemplate();
            context: { error: error(), retry: handleRetry.bind(this) }
          "
        ></ng-container>
      } @else {
        <div class="error-boundary-container">
          <mat-card appearance="outlined" class="error-card">
            <mat-card-header>
              <mat-icon class="error-icon">{{ getErrorIcon() }}</mat-icon>
              <mat-card-title>{{ getErrorTitle() }}</mat-card-title>
            </mat-card-header>

            <mat-card-content>
              <p class="error-message">{{ error()!.message }}</p>

              @if (showDetails()) {
                <div class="error-details">
                  <p class="text-label-small">
                    Catégorie: {{ error()!.category }}
                  </p>
                  @if (error()!.code) {
                    <p class="text-label-small">Code: {{ error()!.code }}</p>
                  }
                  <p class="text-label-small">
                    Heure: {{ error()!.timestamp | date: 'short' }}
                  </p>
                </div>
              }
            </mat-card-content>

            <mat-card-actions>
              @if (error()!.retryable && !hideRetryButton()) {
                <button
                  mat-button="filled"
                  [disabled]="isRetrying()"
                  (click)="handleRetry()"
                >
                  @if (isRetrying()) {
                    <mat-icon>hourglass_empty</mat-icon>
                    Nouvelle tentative...
                  } @else {
                    <mat-icon>refresh</mat-icon>
                    Réessayer
                  }
                </button>
              }

              @if (showResetButton()) {
                <button mat-button="text" (click)="handleReset()">
                  Réinitialiser
                </button>
              }
            </mat-card-actions>
          </mat-card>
        </div>
      }
    } @else {
      <ng-content />
    }
  `,
  styles: [
    `
      @use '@angular/material' as mat;

      :host {
        display: block;
      }

      .error-boundary-container {
        padding: 16px;
      }

      .error-card {
        max-width: 600px;
        margin: 0 auto;

        @include mat.card-overrides(
          (
            outlined-container-color: var(--mat-sys-error-container),
            outlined-outline-color: var(--mat-sys-error),
          )
        );
      }

      .error-icon {
        color: var(--mat-sys-error);
        margin-right: 8px;
      }

      .error-message {
        margin: 16px 0;
        color: var(--mat-sys-on-error-container);
      }

      .error-details {
        margin-top: 12px;
        padding: 12px;
        background-color: var(--mat-sys-surface-variant);
        border-radius: 4px;

        p {
          margin: 4px 0;
          color: var(--mat-sys-on-surface-variant);
        }
      }

      mat-card-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorBoundary implements OnDestroy {
  readonly #errorManager = inject(ErrorManager);

  // Inputs
  showDetails = input(false);
  showResetButton = input(true);
  hideRetryButton = input(false);
  clearOnDestroy = input(true);

  // Outputs
  retry = output<void>();
  resetError = output<void>();
  errorCaught = output<PulpeError>();

  // Content projection for custom error template
  customErrorTemplate =
    contentChild<TemplateRef<{ error: PulpeError; retry: () => void }>>(
      'errorTemplate',
    );

  // State
  readonly error = signal<PulpeError | null>(null);
  readonly isRetrying = signal(false);

  constructor() {
    // Watch for errors from ErrorManager
    effect(() => {
      const currentError = this.#errorManager.currentError();
      if (currentError) {
        this.error.set(currentError);
        this.errorCaught.emit(currentError);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.clearOnDestroy()) {
      this.clearError();
    }
  }

  /**
   * Set error manually
   */
  setError(error: PulpeError): void {
    this.error.set(error);
    this.errorCaught.emit(error);
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this.error.set(null);
    this.#errorManager.clearCurrentError();
  }

  /**
   * Handle retry action
   */
  handleRetry(): void {
    const currentError = this.error();
    if (!currentError || !currentError.retryable) return;

    this.isRetrying.set(true);
    this.retry.emit();

    // Clear retry state after a delay
    setTimeout(() => {
      this.isRetrying.set(false);
      // Clear error if retry was initiated
      this.clearError();
    }, 1000);
  }

  /**
   * Handle reset action
   */
  handleReset(): void {
    this.clearError();
    this.resetError.emit();
  }

  /**
   * Get error icon based on category
   */
  getErrorIcon(): string {
    const error = this.error();
    if (!error) return 'error_outline';

    switch (error.category) {
      case ErrorCategory.NETWORK:
        return 'wifi_off';
      case ErrorCategory.VALIDATION:
        return 'rule';
      case ErrorCategory.BUSINESS:
        return 'business_center';
      case ErrorCategory.SYSTEM:
        return 'report_problem';
      default:
        return 'error_outline';
    }
  }

  /**
   * Get error title based on category
   */
  getErrorTitle(): string {
    const error = this.error();
    if (!error) return 'Erreur';

    switch (error.category) {
      case ErrorCategory.NETWORK:
        return 'Erreur de connexion';
      case ErrorCategory.VALIDATION:
        return 'Données invalides';
      case ErrorCategory.BUSINESS:
        return 'Opération non autorisée';
      case ErrorCategory.SYSTEM:
        return 'Erreur système';
      default:
        return 'Erreur inattendue';
    }
  }
}
