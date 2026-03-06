import {
  afterNextRender,
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
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
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
    TranslocoPipe,
    GoogleOAuthButton,
    ErrorAlert,
    LoadingButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
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
        {{ 'welcome.eyebrow' | transloco }}
      </p>

      <!-- Title -->
      <h1
        class="text-headline-large md:text-display-small font-bold text-on-surface leading-tight text-center mb-2"
        data-testid="welcome-title"
      >
        {{ 'welcome.title' | transloco }}
      </h1>

      <!-- Subtitle -->
      <p
        class="text-body-large text-on-surface-variant text-center leading-relaxed mb-4"
        data-testid="welcome-subtitle"
      >
        {{ 'welcome.subtitle' | transloco }}
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
            >{{ 'common.or' | transloco }}</span
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
            <span>{{ 'welcome.emailSignup' | transloco }}</span>
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
          [loadingText]="'welcome.demoLoading' | transloco"
          icon="play_arrow"
          testId="demo-mode-button"
          data-testid="demo-link"
          class="w-full"
          (click)="startDemoMode()"
        >
          {{ 'welcome.tryWithoutAccount' | transloco }}
        </pulpe-loading-button>

        <pulpe-error-alert [message]="errorMessage()" class="w-full" />
      </div>

      <!-- Legal -->
      <p
        class="text-xs text-on-surface-variant text-center mt-5"
        data-testid="app-version"
      >
        {{ 'welcome.legalPrefix' | transloco }}
        <a
          [routerLink]="['/', ROUTES.LEGAL, ROUTES.LEGAL_TERMS]"
          target="_blank"
          class="text-primary underline"
          >{{ 'welcome.termsShort' | transloco }}</a
        >
        {{ 'welcome.legalAnd' | transloco }}
        <a
          [routerLink]="['/', ROUTES.LEGAL, ROUTES.LEGAL_PRIVACY]"
          target="_blank"
          class="text-primary underline"
          >{{ 'welcome.privacyPolicy' | transloco }}</a
        >
      </p>

      <!-- Login link -->
      <p class="text-sm text-on-surface-variant mt-4">
        {{ 'welcome.alreadyAccount' | transloco }}
        <button
          matButton
          [routerLink]="['/', ROUTES.LOGIN]"
          class="text-primary font-semibold"
        >
          {{ 'welcome.signin' | transloco }}
        </button>
      </p>
    </div>
  `,
})
export default class WelcomePage {
  readonly #demoInitializer = inject(DemoInitializerService);
  readonly #logger = inject(Logger);
  readonly #postHogService = inject(PostHogService);
  readonly #transloco = inject(TranslocoService);
  protected readonly turnstileService = inject(TurnstileService);
  protected readonly ROUTES = ROUTES;

  constructor() {
    afterNextRender(() => {
      this.#postHogService.captureEvent('welcome_page_viewed');
    });
  }

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
      this.#postHogService.setPendingSignupMethod('google');
      this.#postHogService.captureEvent('signup_started', { method: 'google' });
    } else {
      this.#postHogService.clearPendingSignupMethod();
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
      this.#postHogService.captureEvent('demo_started');
    } catch (error) {
      this.#logger.error('Failed to start demo mode', { error });
      this.errorMessage.set(
        this.#transloco.translate('welcome.demoInitFailed'),
      );
      this.turnstileService.reset();
    }
  }
}
