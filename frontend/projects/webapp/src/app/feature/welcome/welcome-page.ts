import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { AuthApi } from '@core/auth/auth-api';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { DemoInitializerService } from '@core/demo/demo-initializer.service';
import { Logger } from '@core/logging/logger';
import { ROUTES } from '@core/routing';
import { LottieComponent, type AnimationOptions } from 'ngx-lottie';
import { NgxTurnstileModule, type NgxTurnstileComponent } from 'ngx-turnstile';

@Component({
  selector: 'pulpe-welcome-page',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    LottieComponent,
    RouterLink,
    NgxTurnstileModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="min-h-screen pulpe-gradient flex items-center justify-center p-4"
    >
      <div
        class="w-full max-w-3xl min-h-[600px] md:h-[800px] bg-surface rounded-2xl md:p-16 p-8 flex flex-col items-center justify-center gap-6 md:gap-10"
        data-testid="welcome-page"
      >
        <div class="text-center">
          <h1 class="text-headline-large text-on-surface">
            Bienvenue dans Pulpe
          </h1>

          @defer (on idle) {
            <div class="flex justify-center md:mb-6">
              <ng-lottie
                [options]="lottieOptions"
                class="md:w-80 md:h-80 mt-[-86px] md:mt-[-100px]"
                style="background: transparent !important;"
              />
            </div>
          } @placeholder {
            <div
              class="flex justify-center mb-6 md:w-80 md:h-80 mt-[-86px] md:mt-[-100px] items-center"
            >
              <div
                class="w-24 h-24 bg-primary/10 rounded-full animate-pulse"
              ></div>
            </div>
          } @loading {
            <div
              class="flex justify-center mb-6 md:w-80 md:h-80 mt-[-86px] md:mt-[-100px] items-center"
            >
              <div
                class="w-24 h-24 bg-primary/20 rounded-full animate-pulse"
              ></div>
            </div>
          } @error {
            <div
              class="flex justify-center mb-6 md:w-80 md:h-80 mt-[-86px] md:mt-[-100px] items-center"
            >
              <span class="text-on-surface-variant text-4xl"></span>
            </div>
          }

          <p
            class="text-body-large text-on-surface-variant md:leading-relaxed px-4"
          >
            Reprends le contrôle de tes finances en quelques minutes
          </p>
        </div>

        <div class="flex gap-4 flex-col items-center justify-center w-full">
          <button
            matButton="filled"
            color="primary"
            class="w-full max-w-sm h-12"
            data-testid="google-oauth-button"
            [disabled]="isLoading()"
            (click)="signInWithGoogle()"
          >
            @if (isGoogleLoading()) {
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
                <span>Continuer avec Google</span>
              </div>
            }
          </button>

          <button
            matButton="outlined"
            class="w-full max-w-sm h-12"
            data-testid="email-signup-button"
            [disabled]="isLoading()"
            [routerLink]="['/', ROUTES.SIGNUP]"
          >
            <div class="flex items-center justify-center gap-2">
              <mat-icon>email</mat-icon>
              <span>Utiliser mon email</span>
            </div>
          </button>

          @if (shouldRenderTurnstile() && shouldUseTurnstile()) {
            <ngx-turnstile
              #turnstileWidget
              [siteKey]="turnstileSiteKey()"
              [appearance]="'interaction-only'"
              [theme]="'light'"
              (resolved)="onTurnstileResolved($event)"
              (errored)="onTurnstileError()"
              class="hidden"
            />
          }

          <button
            matButton="tonal"
            type="button"
            data-testid="demo-mode-button"
            class="w-full max-w-sm h-12"
            [disabled]="isLoading()"
            (click)="startDemoMode()"
          >
            @if (isDemoLoading()) {
              <div class="flex justify-center items-center">
                <mat-progress-spinner
                  mode="indeterminate"
                  [diameter]="20"
                  aria-label="Initialisation du mode démo"
                  role="progressbar"
                  class="pulpe-loading-indicator pulpe-loading-small mr-2"
                ></mat-progress-spinner>
                <span aria-live="polite">Préparation...</span>
              </div>
            } @else {
              <div class="flex justify-center items-center gap-2">
                <mat-icon>science</mat-icon>
                Essayer le mode démo
              </div>
            }
          </button>

          @if (errorMessage()) {
            <div
              class="bg-error-container text-on-error-container p-3 rounded-lg mt-3 text-body-small flex items-center gap-2 w-full max-w-sm"
            >
              <mat-icon class="flex-shrink-0 text-base">error_outline</mat-icon>
              <span>{{ errorMessage() }}</span>
            </div>
          }
        </div>

        <div class="w-full flex-col gap-2 flex justify-center items-center">
          <p class="text-body-small text-on-surface-variant">
            Tu as déjà un compte ?
          </p>
          <button
            matButton
            [routerLink]="['/', ROUTES.LOGIN]"
            class="w-full max-w-sm"
          >
            Se connecter
          </button>
        </div>
      </div>
    </div>
  `,
})
export default class WelcomePage {
  readonly #authApi = inject(AuthApi);
  readonly #demoInitializer = inject(DemoInitializerService);
  readonly #logger = inject(Logger);
  readonly #config = inject(ApplicationConfiguration);
  protected readonly ROUTES = ROUTES;

  readonly #ERROR_MESSAGES = {
    TURNSTILE_FAILED:
      'Échec de la vérification de sécurité. Veuillez réessayer.',
    ANTI_ROBOT_FAILED:
      'Échec de la vérification anti-robot. Veuillez réessayer.',
    DEMO_INIT_FAILED:
      'Impossible de démarrer le mode démo. Veuillez réessayer.',
    GOOGLE_AUTH_FAILED:
      'Erreur lors de la connexion avec Google. Veuillez réessayer.',
  } as const;

  readonly #TURNSTILE_TIMEOUT_MS = 5000;
  #turnstileTimeoutId: ReturnType<typeof setTimeout> | null = null;
  #turnstileResolutionHandled = false;

  protected readonly errorMessage = signal('');
  protected readonly isGoogleLoading = signal(false);
  protected readonly isDemoInitializing = this.#demoInitializer.isInitializing;
  protected readonly isTurnstileProcessing = signal(false);
  protected readonly isDemoLoading = computed(
    () => this.isTurnstileProcessing() || this.isDemoInitializing(),
  );
  protected readonly isLoading = computed(
    () => this.isGoogleLoading() || this.isDemoLoading(),
  );

  protected readonly turnstileSiteKey = computed(
    () => this.#config.turnstile().siteKey,
  );
  protected readonly shouldUseTurnstile = computed(
    () => !this.#config.isLocal(),
  );

  protected readonly shouldRenderTurnstile = signal(false);

  protected readonly turnstileWidget =
    viewChild<NgxTurnstileComponent>('turnstileWidget');

  protected readonly lottieOptions: AnimationOptions = {
    path: '/lottie/welcome-animation.json',
    loop: true,
    autoplay: true,
    renderer: 'svg',
    rendererSettings: {
      preserveAspectRatio: 'xMidYMid meet',
      progressiveLoad: true,
      hideOnTransparent: true,
    },
    assetsPath: '/lottie/',
  };

  async signInWithGoogle(): Promise<void> {
    this.errorMessage.set('');
    this.isGoogleLoading.set(true);

    try {
      const result = await this.#authApi.signInWithGoogle();

      if (!result.success) {
        this.errorMessage.set(
          result.error || this.#ERROR_MESSAGES.GOOGLE_AUTH_FAILED,
        );
        this.isGoogleLoading.set(false);
      }
    } catch (error) {
      this.#logger.error('Erreur lors de la connexion Google:', error);
      this.errorMessage.set(this.#ERROR_MESSAGES.GOOGLE_AUTH_FAILED);
      this.isGoogleLoading.set(false);
    }
  }

  onTurnstileResolved(token: string | null): void {
    this.#clearTurnstileTimeout();

    if (this.#turnstileResolutionHandled) {
      this.#logger.debug('Turnstile resolution already handled, ignoring');
      return;
    }
    this.#turnstileResolutionHandled = true;

    if (!token) {
      this.#logger.error('Turnstile resolved with null token');
      this.errorMessage.set(this.#ERROR_MESSAGES.TURNSTILE_FAILED);
      this.shouldRenderTurnstile.set(false);
      this.#turnstileResolutionHandled = false;
      return;
    }

    this.#logger.debug('Turnstile resolved', { tokenLength: token.length });
    this.#startDemoWithToken(token);
  }

  onTurnstileError(): void {
    this.#clearTurnstileTimeout();
    this.#logger.error('Turnstile verification failed');
    this.errorMessage.set(this.#ERROR_MESSAGES.TURNSTILE_FAILED);
    this.isTurnstileProcessing.set(false);
    this.shouldRenderTurnstile.set(false);
    this.#turnstileResolutionHandled = false;
  }

  async startDemoMode(): Promise<void> {
    this.errorMessage.set('');
    this.isTurnstileProcessing.set(true);
    this.#turnstileResolutionHandled = false;

    if (
      typeof window !== 'undefined' &&
      (window as { __E2E_DEMO_BYPASS__?: boolean }).__E2E_DEMO_BYPASS__ === true
    ) {
      this.#logger.debug('E2E demo bypass detected, skipping Turnstile');
      await this.#startDemoWithToken('');
      return;
    }

    if (!this.shouldUseTurnstile()) {
      this.#logger.debug('Turnstile skipped in local environment');
      await this.#startDemoWithToken('');
      return;
    }

    if (this.#isSafariIOS()) {
      this.#logger.info('Safari iOS detected, bypassing Turnstile');
      await this.#startDemoWithToken('');
      return;
    }

    this.#turnstileTimeoutId = setTimeout(() => {
      this.#handleTurnstileTimeout();
    }, this.#TURNSTILE_TIMEOUT_MS);

    const widget = this.turnstileWidget();
    if (widget) {
      this.#logger.debug('Resetting existing Turnstile widget');
      widget.reset();
    } else {
      this.#logger.debug('Rendering new Turnstile widget');
      this.shouldRenderTurnstile.set(true);
    }
  }

  async #startDemoWithToken(token: string): Promise<void> {
    try {
      await this.#demoInitializer.startDemoSession(token);
    } catch (error) {
      this.#logger.error('Failed to start demo mode', { error });

      if (error instanceof Error && error.message.includes('anti-robot')) {
        this.errorMessage.set(this.#ERROR_MESSAGES.ANTI_ROBOT_FAILED);
      } else {
        this.errorMessage.set(this.#ERROR_MESSAGES.DEMO_INIT_FAILED);
      }

      this.isTurnstileProcessing.set(false);
      this.shouldRenderTurnstile.set(false);
    }
  }

  #isSafariIOS(): boolean {
    if (typeof navigator === 'undefined') return false;

    const ua = navigator.userAgent;
    const isTouchCapable =
      'maxTouchPoints' in navigator && navigator.maxTouchPoints > 1;

    const isIOS =
      /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && isTouchCapable);

    const isSafari =
      /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);

    return isIOS && isSafari;
  }

  #handleTurnstileTimeout(): void {
    if (this.#turnstileResolutionHandled) {
      this.#logger.debug('Turnstile already resolved, ignoring timeout');
      return;
    }
    this.#turnstileResolutionHandled = true;

    this.#logger.warn('Turnstile timeout (5s) - bypassing verification');
    this.#clearTurnstileTimeout();
    this.shouldRenderTurnstile.set(false);
    this.#startDemoWithToken('');
  }

  #clearTurnstileTimeout(): void {
    if (this.#turnstileTimeoutId) {
      clearTimeout(this.#turnstileTimeoutId);
      this.#turnstileTimeoutId = null;
    }
  }
}
