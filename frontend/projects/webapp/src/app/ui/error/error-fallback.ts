import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

/**
 * Error Fallback Component
 * Simple, robust fallback UI for critical errors
 *
 * This component is designed to be extremely resilient and should work
 * even when other parts of the application fail.
 *
 * Usage:
 * <pulpe-error-fallback
 *   [title]="'Oops!'"
 *   [message]="'Something went wrong'"
 *   (reload)="window.location.reload()"
 * />
 */
@Component({
  selector: 'pulpe-error-fallback',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <div class="error-fallback-container">
      <div class="error-content">
        <!-- Error Icon -->
        <div class="error-icon-wrapper">
          <mat-icon class="error-icon">{{ icon() }}</mat-icon>
        </div>

        <!-- Error Title -->
        <h1 class="error-title">{{ title() }}</h1>

        <!-- Error Message -->
        <p class="error-message">{{ message() }}</p>

        <!-- Actions -->
        <div class="error-actions">
          @if (showReloadButton()) {
            <button mat-button="filled" (click)="handleReload()">
              <mat-icon>refresh</mat-icon>
              Recharger la page
            </button>
          }

          @if (showHomeButton()) {
            <button mat-button="outlined" (click)="handleGoHome()">
              <mat-icon>home</mat-icon>
              Retour à l'accueil
            </button>
          }

          @if (showContactButton()) {
            <button mat-button="text" (click)="handleContact()">
              <mat-icon>help_outline</mat-icon>
              Contacter le support
            </button>
          }
        </div>

        <!-- Additional Info -->
        @if (showDetails() && errorDetails()) {
          <details class="error-details">
            <summary>Détails techniques</summary>
            <pre>{{ errorDetails() }}</pre>
          </details>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        min-height: 400px;
      }

      .error-fallback-container {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: inherit;
        padding: 24px;
        background: linear-gradient(
          135deg,
          var(--mat-sys-error-container) 0%,
          var(--mat-sys-surface) 100%
        );
      }

      .error-content {
        text-align: center;
        max-width: 500px;
        padding: 32px;
        background: var(--mat-sys-surface);
        border-radius: 16px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      }

      .error-icon-wrapper {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 80px;
        height: 80px;
        margin: 0 auto 24px;
        background: var(--mat-sys-error-container);
        border-radius: 50%;
      }

      .error-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--mat-sys-error);
      }

      .error-title {
        margin: 0 0 16px;
        font-size: 24px;
        font-weight: 500;
        color: var(--mat-sys-on-surface);
      }

      .error-message {
        margin: 0 0 32px;
        font-size: 16px;
        line-height: 1.5;
        color: var(--mat-sys-on-surface-variant);
      }

      .error-actions {
        display: flex;
        flex-direction: column;
        gap: 12px;
        align-items: center;

        button {
          min-width: 200px;
        }
      }

      .error-details {
        margin-top: 32px;
        padding: 16px;
        background: var(--mat-sys-surface-variant);
        border-radius: 8px;
        text-align: left;

        summary {
          cursor: pointer;
          font-size: 14px;
          color: var(--mat-sys-on-surface-variant);
          margin-bottom: 8px;

          &:hover {
            color: var(--mat-sys-primary);
          }
        }

        pre {
          margin: 8px 0 0;
          padding: 8px;
          background: var(--mat-sys-surface);
          border-radius: 4px;
          font-size: 12px;
          overflow-x: auto;
          white-space: pre-wrap;
          word-wrap: break-word;
          color: var(--mat-sys-on-surface);
        }
      }

      @media (min-width: 600px) {
        .error-actions {
          flex-direction: row;
          justify-content: center;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorFallback {
  readonly #router = inject(Router, { optional: true });

  // Inputs
  icon = input('warning');
  title = input('Une erreur est survenue');
  message = input(
    'Nous rencontrons un problème technique. Veuillez réessayer dans quelques instants.',
  );
  errorDetails = input<string>();
  showDetails = input(false);
  showReloadButton = input(true);
  showHomeButton = input(true);
  showContactButton = input(false);
  homeRoute = input('/');
  contactUrl = input('mailto:support@pulpe.app');

  // Outputs
  reload = output<void>();
  goHome = output<void>();
  contact = output<void>();

  /**
   * Handle page reload
   */
  handleReload(): void {
    this.reload.emit();
    // Always provide fallback behavior
    // In a real app, the parent component would handle this
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }

  /**
   * Handle navigation to home
   */
  handleGoHome(): void {
    this.goHome.emit();
    // Fallback to router navigation if available
    if (this.#router) {
      this.#router.navigate([this.homeRoute()]).catch(() => {
        // If routing fails, try window navigation
        window.location.href = this.homeRoute();
      });
    } else {
      window.location.href = this.homeRoute();
    }
  }

  /**
   * Handle contact support
   */
  handleContact(): void {
    this.contact.emit();
    // Also open contact URL
    window.open(this.contactUrl(), '_blank');
  }
}
