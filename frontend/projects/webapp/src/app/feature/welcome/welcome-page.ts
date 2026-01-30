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
import { RouterLink } from '@angular/router';
import { GoogleOAuthButton } from '@app/pattern/google-oauth';
import { PostHogService } from '@core/analytics/posthog';
import { DemoInitializerService } from '@core/demo/demo-initializer.service';
import { Logger } from '@core/logging/logger';
import { ROUTES } from '@core/routing';
import { TurnstileService } from '@core/turnstile';
import { ErrorAlert } from '@ui/error-alert';
import { LoadingButton } from '@ui/loading-button';
import { LottieComponent, type AnimationOptions } from 'ngx-lottie';
import { NgxTurnstileModule, type NgxTurnstileComponent } from 'ngx-turnstile';

@Component({
  selector: 'pulpe-welcome-page',
  imports: [
    MatButtonModule,
    MatIconModule,
    LottieComponent,
    RouterLink,
    NgxTurnstileModule,
    GoogleOAuthButton,
    ErrorAlert,
    LoadingButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="min-h-screen pulpe-gradient flex items-center justify-center p-4"
    >
      <div
        class="w-full max-w-lg bg-surface rounded-3xl p-8 md:p-10 flex flex-col items-center shadow-xl"
        data-testid="welcome-page"
      >
        <!-- Branding -->
        <img src="/logo.svg" alt="Pulpe" class="h-14 md:h-16 mb-6" />

        <!-- Eyebrow -->
        <p
          class="text-xs font-semibold tracking-widest uppercase text-primary mb-3"
          style="font-family: 'Poppins', sans-serif"
        >
          Budget annuel en 3 minutes
        </p>

        <!-- Title -->
        <h1
          class="text-2xl md:text-4xl font-bold text-on-surface leading-tight text-center mb-2"
          style="font-family: 'Poppins', sans-serif"
        >
          Vois clair dans tes finances
        </h1>

        <!-- Subtitle -->
        <p
          class="text-sm md:text-base text-on-surface-variant text-center leading-relaxed mb-4"
          style="font-family: 'Poppins', sans-serif"
        >
          Planifie ton année, sache toujours ce que tu peux dépenser.
        </p>

        <!-- Lottie animation -->
        @defer (on idle) {
          <div class="flex justify-center mb-6">
            <ng-lottie
              [options]="lottieOptions"
              class="hidden md:block w-60 h-45 md:w-120 md:h-80 -mt-10 md:-mt-18"
              style="background: transparent !important;"
            />
          </div>
        } @placeholder {
          <div class="flex justify-center mb-6">
            <div
              class="w-56 h-40 md:w-72 md:h-48 flex items-center justify-center"
            >
              <div
                class="w-16 h-16 bg-primary/10 rounded-full animate-pulse"
              ></div>
            </div>
          </div>
        } @loading {
          <div class="flex justify-center mb-6">
            <div
              class="w-56 h-40 md:w-72 md:h-48 flex items-center justify-center"
            >
              <div
                class="w-16 h-16 bg-primary/20 rounded-full animate-pulse"
              ></div>
            </div>
          </div>
        } @error {
          <div class="flex justify-center mb-6">
            <div class="w-56 h-40 md:w-72 md:h-48"></div>
          </div>
        }

        <!-- CTAs -->
        <div class="flex flex-col gap-3 w-full">
          <pulpe-google-oauth-button
            class="w-full"
            buttonType="filled"
            testId="google-oauth-button"
            (authError)="errorMessage.set($event)"
            (loadingChange)="onGoogleLoadingChange($event)"
          />

          <button
            matButton="outlined"
            class="w-full h-12"
            data-testid="email-signup-button"
            [disabled]="isLoading()"
            [routerLink]="['/', ROUTES.SIGNUP]"
            (click)="onEmailSignupClick()"
          >
            <div class="flex items-center justify-center gap-2">
              <mat-icon>email</mat-icon>
              <span>Continuer avec mon email</span>
            </div>
          </button>

          @if (
            turnstileService.shouldRender() &&
            turnstileService.shouldUseTurnstile()
          ) {
            <ngx-turnstile
              #turnstileWidget
              [siteKey]="turnstileService.siteKey()"
              [appearance]="'interaction-only'"
              [theme]="'light'"
              (resolved)="turnstileService.handleResolved($event)"
              (errored)="turnstileService.handleError()"
              class="hidden"
            />
          }

          <pulpe-loading-button
            [loading]="isDemoLoading()"
            [disabled]="isLoading()"
            variant="tonal"
            type="button"
            loadingText="Préparation..."
            icon="play_arrow"
            testId="demo-mode-button"
            class="w-full"
            (click)="startDemoMode()"
          >
            Essayer gratuitement
          </pulpe-loading-button>

          <pulpe-error-alert [message]="errorMessage()" class="w-full" />
        </div>

        <!-- Legal -->
        <p class="text-xs text-on-surface-variant text-center mt-5">
          En continuant, j'accepte les
          <a
            [routerLink]="['/', ROUTES.LEGAL, ROUTES.LEGAL_TERMS]"
            target="_blank"
            class="text-primary underline"
            >CGU</a
          >
          et la
          <a
            [routerLink]="['/', ROUTES.LEGAL, ROUTES.LEGAL_PRIVACY]"
            target="_blank"
            class="text-primary underline"
            >Politique de Confidentialité</a
          >
        </p>

        <!-- Login link -->
        <p class="text-sm text-on-surface-variant mt-4">
          Tu as déjà un compte ?
          <a
            [routerLink]="['/', ROUTES.LOGIN]"
            class="text-primary font-semibold"
          >
            Se connecter
          </a>
        </p>
      </div>
    </div>
  `,
})
export default class WelcomePage {
  readonly #demoInitializer = inject(DemoInitializerService);
  readonly #logger = inject(Logger);
  readonly #postHogService = inject(PostHogService);
  protected readonly turnstileService = inject(TurnstileService);
  protected readonly ROUTES = ROUTES;

  readonly #ERROR_MESSAGES = {
    DEMO_INIT_FAILED: 'Le mode démo ne démarre pas — réessayons',
  } as const;

  protected readonly errorMessage = signal('');
  protected readonly isGoogleLoading = signal(false);
  protected readonly isDemoInitializing = this.#demoInitializer.isInitializing;
  protected readonly isDemoLoading = computed(
    () => this.turnstileService.isProcessing() || this.isDemoInitializing(),
  );
  protected readonly isLoading = computed(
    () => this.isGoogleLoading() || this.isDemoLoading(),
  );

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

  onGoogleLoadingChange(isLoading: boolean): void {
    this.isGoogleLoading.set(isLoading);
    if (isLoading) {
      this.#postHogService.captureEvent('signup_started', { method: 'google' });
    }
  }

  onEmailSignupClick(): void {
    this.#postHogService.captureEvent('signup_started', { method: 'email' });
  }

  startDemoMode(): void {
    this.errorMessage.set('');

    this.turnstileService.startVerification(
      this.turnstileWidget(),
      (token) => this.#startDemoWithToken(token),
      (message) => this.errorMessage.set(message),
    );
  }

  async #startDemoWithToken(token: string): Promise<void> {
    try {
      await this.#demoInitializer.startDemoSession(token);
    } catch (error) {
      this.#logger.error('Failed to start demo mode', { error });
      this.errorMessage.set(this.#ERROR_MESSAGES.DEMO_INIT_FAILED);
      this.turnstileService.reset();
    }
  }
}
