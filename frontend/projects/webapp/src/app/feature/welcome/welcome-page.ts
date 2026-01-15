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
          <pulpe-google-oauth-button
            class="w-full max-w-sm"
            buttonType="filled"
            testId="google-oauth-button"
            (authError)="errorMessage.set($event)"
            (loadingChange)="onGoogleLoadingChange($event)"
          />

          <p
            class="text-body-small text-on-surface-variant text-center max-w-sm"
          >
            En continuant avec Google, j'accepte les
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

          <button
            matButton="outlined"
            class="w-full max-w-sm h-12"
            data-testid="email-signup-button"
            [disabled]="isLoading()"
            [routerLink]="['/', ROUTES.SIGNUP]"
            (click)="onEmailSignupClick()"
          >
            <div class="flex items-center justify-center gap-2">
              <mat-icon>email</mat-icon>
              <span>Utiliser mon email</span>
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
            icon="science"
            testId="demo-mode-button"
            class=" w-full max-w-sm"
            (click)="startDemoMode()"
          >
            Essayer le mode démo
          </pulpe-loading-button>

          <pulpe-error-alert
            [message]="errorMessage()"
            class="w-full max-w-sm"
          />
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
  readonly #demoInitializer = inject(DemoInitializerService);
  readonly #logger = inject(Logger);
  readonly #postHogService = inject(PostHogService);
  protected readonly turnstileService = inject(TurnstileService);
  protected readonly ROUTES = ROUTES;

  readonly #ERROR_MESSAGES = {
    DEMO_INIT_FAILED:
      'Le mode démo ne démarre pas — réessayons',
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
