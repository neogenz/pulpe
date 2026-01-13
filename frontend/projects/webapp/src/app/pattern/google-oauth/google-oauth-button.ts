import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AUTH_ERROR_MESSAGES, AuthApi } from '@core/auth';
import { Logger } from '@core/logging/logger';

@Component({
  selector: 'pulpe-google-oauth-button',
  imports: [
    NgTemplateOutlet,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (buttonType() === 'filled') {
      <button
        matButton="filled"
        color="primary"
        type="button"
        class="w-full h-12"
        [attr.data-testid]="testId()"
        [disabled]="isLoading()"
        (click)="signInWithGoogle()"
      >
        <ng-container *ngTemplateOutlet="buttonContent" />
      </button>
    } @else {
      <button
        matButton="outlined"
        type="button"
        class="w-full h-12"
        [attr.data-testid]="testId()"
        [disabled]="isLoading()"
        (click)="signInWithGoogle()"
      >
        <ng-container *ngTemplateOutlet="buttonContent" />
      </button>
    }

    <ng-template #buttonContent>
      @if (isLoading()) {
        <div class="flex items-center justify-center">
          <mat-progress-spinner
            mode="indeterminate"
            [diameter]="20"
            aria-label="Connexion en cours"
            role="progressbar"
            class="pulpe-loading-indicator pulpe-loading-small mr-2"
          ></mat-progress-spinner>
          <span aria-live="polite">Connexion en cours...</span>
        </div>
      } @else {
        <div class="flex items-center justify-center gap-2">
          <mat-icon svgIcon="google" />
          <span>{{ buttonLabel() }}</span>
        </div>
      }
    </ng-template>
  `,
})
export class GoogleOAuthButton {
  readonly #authApi = inject(AuthApi);
  readonly #logger = inject(Logger);

  readonly buttonLabel = input<string>('Continuer avec Google');
  readonly buttonType = input<'filled' | 'outlined'>('outlined');
  readonly testId = input<string>('google-oauth-button');

  readonly loadingChange = output<boolean>();
  readonly authError = output<string>();

  readonly isLoading = signal<boolean>(false);

  async signInWithGoogle(): Promise<void> {
    this.isLoading.set(true);
    this.loadingChange.emit(true);

    try {
      const result = await this.#authApi.signInWithGoogle();

      if (!result.success) {
        this.authError.emit(
          result.error ?? AUTH_ERROR_MESSAGES.GOOGLE_CONNECTION_ERROR,
        );
      }
    } catch (err) {
      this.#logger.error('Google OAuth error', err);
      this.authError.emit(AUTH_ERROR_MESSAGES.GOOGLE_CONNECTION_ERROR);
    } finally {
      this.isLoading.set(false);
      this.loadingChange.emit(false);
    }
  }
}
