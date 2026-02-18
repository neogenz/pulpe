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
    <div class="pulpe-entry-shell pulpe-gradient">
      <div
        class="pulpe-entry-card w-full max-w-lg items-center"
        data-testid="welcome-page"
      >
        <!-- Branding -->
        <img src="/logo.svg" alt="Pulpe" class="h-14 md:h-16 mb-6" />

        <!-- Eyebrow -->
        <p
          class="text-xs font-semibold tracking-widest uppercase text-primary mb-3"
        >
          Budget annuel en 3 minutes
        </p>

        <!-- Title -->
        <h1
          class="text-headline-large md:text-display-small font-bold text-on-surface leading-tight text-center mb-2"
          data-testid="welcome-title"
        >
          Vois clair dans tes finances
        </h1>

        <!-- Subtitle -->
        <p
          class="text-body-large text-on-surface-variant text-center leading-relaxed mb-4"
          data-testid="welcome-subtitle"
        >
          Planifie ton année, sache toujours ce que tu peux dépenser.
        </p>

        <!-- Lottie animation -->
        @defer (on idle) {
          <div class="flex justify-center mb-6">
            <ng-lottie
              [options]="lottieOptions"
              class="hidden md:block w-60 h-44 md:w-120 md:h-80 -mt-10 md:-mt-20 bg-transparent"
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
            buttonType="outlined"
            testId="google-oauth-button"
            (authError)="errorMessage.set($event)"
            (loadingChange)="onGoogleLoadingChange($event)"
          />

          <!-- Separator -->
          <div class="flex items-center gap-4 my-1">
            <div class="flex-1 h-px bg-outline-variant/30"></div>
            <span
              class="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest"
              >OU</span
            >
            <div class="flex-1 h-px bg-outline-variant/30"></div>
          </div>

          <button
            matButton="filled"
            class="w-full h-12"
            data-testid="email-signup-button"
            [disabled]="isLoading()"
            [routerLink]="['/', ROUTES.SIGNUP]"
            (click)="onEmailSignupClick()"
          >
            <div class="flex items-center justify-center gap-2">
              <mat-icon>email</mat-icon>
              <span>S'inscrire par e-mail</span>
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
            variant=""
            type="button"
            loadingText="Préparation..."
            icon="play_arrow"
            testId="demo-mode-button"
            data-testid="demo-link"
            class="w-full"
            (click)="startDemoMode()"
          >
            Essayer sans compte
          </pulpe-loading-button>

          <pulpe-error-alert [message]="errorMessage()" class="w-full" />
        </div>

        <!-- Legal -->
        <p
          class="text-xs text-on-surface-variant text-center mt-5"
          data-testid="app-version"
        >
          En continuant, tu acceptes les
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
          Déjà un compte ?
          <button
            matButton
            [routerLink]="['/', ROUTES.LOGIN]"
            class="text-primary font-semibold"
          >
            Se connecter
          </button>
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
    DEMO_INIT_FAILED: 'Le mode démo ne démarre pas — réessaie',
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
