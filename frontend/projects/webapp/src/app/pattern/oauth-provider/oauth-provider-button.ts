import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  AUTH_ERROR_KEYS,
  AuthOAuthService,
  type OAuthProvider,
} from '@core/auth';
import { Logger } from '@core/logging/logger';

const PROVIDER_LABEL_KEYS: Record<OAuthProvider, string> = {
  google: 'auth.continueWithGoogle',
  apple: 'auth.continueWithApple',
};

@Component({
  selector: 'pulpe-oauth-provider-button',
  imports: [
    NgTemplateOutlet,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (buttonType() === 'filled') {
      <button
        matButton="filled"
        color="primary"
        type="button"
        class="w-full h-12"
        [attr.data-testid]="resolvedTestId()"
        [disabled]="isLoading() || disabled()"
        (click)="signIn()"
      >
        <ng-container *ngTemplateOutlet="buttonContent" />
      </button>
    } @else {
      <button
        matButton="outlined"
        type="button"
        class="w-full h-12"
        [class.pulpe-apple-signin]="provider() === 'apple'"
        [attr.data-testid]="resolvedTestId()"
        [disabled]="isLoading() || disabled()"
        (click)="signIn()"
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
            [attr.aria-label]="'auth.oauthLoading' | transloco"
            role="progressbar"
            class="pulpe-loading-indicator pulpe-loading-small mr-2"
          ></mat-progress-spinner>
          <span aria-live="polite">{{ 'auth.oauthLoading' | transloco }}</span>
        </div>
      } @else {
        <div class="flex items-center justify-center gap-2">
          <mat-icon [svgIcon]="provider()" />
          <span>{{ labelKey() | transloco }}</span>
        </div>
      }
    </ng-template>
  `,
})
export class OAuthProviderButton {
  readonly #authOAuth = inject(AuthOAuthService);
  readonly #transloco = inject(TranslocoService);
  readonly #logger = inject(Logger);

  // Default instead of required: the vitest JIT env only registers signal
  // inputs at first instantiation, so a required input NG0950s in child
  // renders. AOT (real app) binds the actual provider either way.
  readonly provider = input<OAuthProvider>('google');
  readonly buttonType = input<'filled' | 'outlined'>('outlined');
  readonly testId = input<string>('');
  // Le parent gèle le bouton pendant qu'un autre submit est en vol (email,
  // demo/turnstile) : un redirect OAuth abandonnerait un compte peut-être
  // déjà créé côté serveur.
  readonly disabled = input(false);

  readonly loadingChange = output<boolean>();
  readonly authError = output<string>();

  protected readonly isLoading = signal<boolean>(false);

  protected readonly labelKey = computed(
    () => PROVIDER_LABEL_KEYS[this.provider()],
  );
  protected readonly resolvedTestId = computed(
    () => this.testId() || `${this.provider()}-oauth-button`,
  );

  protected async signIn(): Promise<void> {
    if (this.disabled()) return;
    this.isLoading.set(true);
    this.loadingChange.emit(true);

    try {
      const result = await this.#authOAuth.signInWithOAuth(this.provider());

      if (!result.success) {
        this.authError.emit(
          result.error ??
            this.#transloco.translate(AUTH_ERROR_KEYS.OAUTH_CONNECTION_ERROR),
        );
      }
    } catch (err) {
      this.#logger.error(`${this.provider()} OAuth error`, err);
      this.authError.emit(
        this.#transloco.translate(AUTH_ERROR_KEYS.OAUTH_CONNECTION_ERROR),
      );
    } finally {
      this.isLoading.set(false);
      this.loadingChange.emit(false);
    }
  }
}
