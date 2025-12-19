import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { DemoInitializerService } from '@core/demo/demo-initializer.service';
import { Logger } from '@core/logging/logger';
import { ROUTES } from '@core/routing';
import { LottieComponent, type AnimationOptions } from 'ngx-lottie';
import { NgxTurnstileModule, type NgxTurnstileComponent } from 'ngx-turnstile';

@Component({
  selector: 'pulpe-welcome',
  imports: [
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatProgressSpinnerModule,
    LottieComponent,
    RouterLink,
    NgxTurnstileModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex flex-col items-center justify-center h-full md:gap-10 gap-6"
      data-testid="onboarding-welcome-page"
    >
      <div class="text-center">
        <h1 class="text-headline-large text-on-surface">
          Bienvenue dans Pulpe
        </h1>

        @defer (on idle) {
          <div class="flex justify-center md:mb-6">
            <!-- Animation offset: Compensates for Lottie container padding (Mobile: -86px, Desktop: -100px) -->
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
            <span class="text-on-surface-variant text-4xl">🎨</span>
          </div>
        }

        <p
          class="text-body-large text-on-surface-variant md:leading-relaxed px-4"
        >
          Planifie ton année en 5 minutes. Dépense l'esprit tranquille.
        </p>
      </div>
      <div
        class="flex gap-4 flex-col items-center justify-center flex-1 w-full"
      >
        <div class="flex gap-4 flex-col items-center w-full">
          <button
            matButton="filled"
            color="primary"
            class="w-full max-w-sm"
            data-testid="welcome-start-button"
            (click)="onNext()"
          >
            Commencer
          </button>

          <!-- Turnstile Widget - Rendered on-demand when user clicks demo button -->
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
            class="w-full max-w-sm"
            [disabled]="isLoading()"
            (click)="startDemoMode()"
          >
            @if (isLoading()) {
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

          @if (demoErrorMessage()) {
            <div
              class="bg-error-container text-on-error-container p-3 rounded-lg mt-3 text-body-small flex items-center gap-2"
            >
              <mat-icon class="flex-shrink-0 text-base">error_outline</mat-icon>
              <span>{{ demoErrorMessage() }}</span>
            </div>
          }
        </div>
      </div>

      <div class="w-full flex-col gap-2 flex justify-center items-center">
        <p class="text-body-small">Tu as déjà un compte ?</p>
        <button
          matButton
          [routerLink]="['/', ROUTES.LOGIN]"
          class="w-full max-w-sm"
        >
          Se connecter
        </button>
      </div>
    </div>
  `,
})
export default class Welcome {
  readonly #router = inject(Router);
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
  } as const;

  readonly #TURNSTILE_TIMEOUT_MS = 5000;
  #turnstileTimeoutId: ReturnType<typeof setTimeout> | null = null;
  #turnstileResolutionHandled = false;

  protected readonly demoErrorMessage = signal('');
  protected readonly isDemoInitializing = this.#demoInitializer.isInitializing;
  protected readonly isTurnstileProcessing = signal(false);
  protected readonly isLoading = computed(
    () => this.isTurnstileProcessing() || this.isDemoInitializing(),
  );

  protected readonly turnstileSiteKey = computed(
    () => this.#config.turnstile().siteKey,
  );
  protected readonly shouldUseTurnstile = computed(
    () => !this.#config.isLocal(),
  );

  // Control when to render Turnstile widget (lazy rendering on user click)
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

  @HostListener('keydown.enter')
  onEnter(): void {
    this.#continueToNext();
  }

  onNext(): void {
    this.#continueToNext();
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
      this.demoErrorMessage.set(this.#ERROR_MESSAGES.TURNSTILE_FAILED);
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
    this.demoErrorMessage.set(this.#ERROR_MESSAGES.TURNSTILE_FAILED);
    this.isTurnstileProcessing.set(false);
    this.shouldRenderTurnstile.set(false);
    this.#turnstileResolutionHandled = false;
  }

  async startDemoMode(): Promise<void> {
    this.demoErrorMessage.set('');
    this.isTurnstileProcessing.set(true);
    this.#turnstileResolutionHandled = false;

    // E2E Test Bypass - skip Turnstile widget entirely
    if (
      typeof window !== 'undefined' &&
      (window as { __E2E_DEMO_BYPASS__?: boolean }).__E2E_DEMO_BYPASS__ === true
    ) {
      this.#logger.debug('E2E demo bypass detected, skipping Turnstile');
      await this.#startDemoWithToken('');
      return;
    }

    // In local environment, bypass Turnstile and call backend directly
    // Backend already skips Turnstile verification in non-production environments
    if (!this.shouldUseTurnstile()) {
      this.#logger.debug('Turnstile skipped in local environment');
      await this.#startDemoWithToken('');
      return;
    }

    // Safari iOS bypass - Turnstile cross-origin communication is blocked
    // Protection maintained via backend rate limiting (30 req/h/IP)
    if (this.#isSafariIOS()) {
      this.#logger.info('Safari iOS detected, bypassing Turnstile');
      await this.#startDemoWithToken('');
      return;
    }

    // Start timeout - if Turnstile doesn't respond in 5s, bypass it
    this.#turnstileTimeoutId = setTimeout(() => {
      this.#handleTurnstileTimeout();
    }, this.#TURNSTILE_TIMEOUT_MS);

    // Try to reset existing widget first, otherwise render new one
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
      // Navigation is handled by the service
    } catch (error) {
      this.#logger.error('Failed to start demo mode', { error });

      if (error instanceof Error && error.message.includes('anti-robot')) {
        this.demoErrorMessage.set(this.#ERROR_MESSAGES.ANTI_ROBOT_FAILED);
      } else {
        this.demoErrorMessage.set(this.#ERROR_MESSAGES.DEMO_INIT_FAILED);
      }

      // Reset processing state and widget for retry
      this.isTurnstileProcessing.set(false);
      this.shouldRenderTurnstile.set(false);
    }
  }

  #continueToNext(): void {
    this.#router.navigate([
      '/',
      ROUTES.ONBOARDING,
      ROUTES.ONBOARDING_PERSONAL_INFO,
    ]);
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
