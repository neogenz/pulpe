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
import { OAuthProviderButton } from '@app/pattern/oauth-provider';
import type { OAuthProvider } from '@core/auth';
import { PostHogService } from '@core/analytics/posthog';
import { DemoInitializerService } from '@core/demo/demo-initializer.service';
import { Logger } from '@core/logging/logger';
import { ROUTES } from '@core/routing';
import { TurnstileService } from '@core/turnstile';
import { ErrorAlert } from '@ui/error-alert';
import { LoadingButton } from '@ui/loading-button';
import { NgxTurnstileModule, type NgxTurnstileComponent } from 'ngx-turnstile';

@Component({
  selector: 'pulpe-welcome-page',
  imports: [
    MatButtonModule,
    MatIconModule,
    RouterLink,
    NgxTurnstileModule,
    TranslocoPipe,
    OAuthProviderButton,
    ErrorAlert,
    LoadingButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="pulpe-welcome-stagger w-full max-w-md mx-auto flex flex-col items-center text-center px-2 md:px-0"
      data-testid="welcome-page"
    >
      <!-- Brand mark -->
      <img
        src="/logo.svg"
        alt="Pulpe"
        class="h-14 md:h-16 mx-auto mb-5 select-none"
        draggable="false"
      />

      <!-- Eyebrow pill -->
      <span class="pulpe-eyebrow-pill mx-auto">
        <span class="pulpe-eyebrow-dot" aria-hidden="true">
          <span class="pulpe-eyebrow-dot-core"></span>
        </span>
        {{ 'welcome.eyebrow' | transloco }}
      </span>

      <!-- Headline -->
      <h1
        class="font-bold text-headline-large md:text-display-small mt-4 text-on-surface [text-wrap:balance]"
        data-testid="welcome-title"
      >
        {{ 'welcome.title' | transloco }}
      </h1>

      <!-- Subtitle -->
      <p
        class="text-body-large text-on-surface-variant mt-3 leading-snug [text-wrap:balance]"
        data-testid="welcome-subtitle"
      >
        {{ 'welcome.subtitle' | transloco }}
      </p>

      <!-- Benefits — show, don't tell: what the product does before asking anything -->
      <ul
        class="mt-6 flex flex-col gap-3 self-center text-left"
        data-testid="welcome-benefits"
      >
        @for (benefit of BENEFITS; track benefit.labelKey) {
          <li class="flex items-center gap-3">
            <mat-icon
              aria-hidden="true"
              class="text-primary !text-xl !w-5 !h-5 shrink-0"
              >{{ benefit.icon }}</mat-icon
            >
            <span class="text-body-medium text-on-surface-variant">
              {{ benefit.labelKey | transloco }}
            </span>
          </li>
        }
      </ul>

      <!-- CTAs -->
      <div class="mt-7 flex flex-col gap-3 w-full">
        <pulpe-loading-button
          [loading]="isDemoLoading()"
          [disabled]="isLoading()"
          variant="filled"
          type="button"
          [loadingText]="'welcome.demoLoading' | transloco"
          icon="play_arrow"
          testId="demo-mode-button"
          data-testid="demo-link"
          class="w-full pulpe-demo-primary"
          (click)="startDemoMode()"
        >
          {{ 'welcome.tryWithoutAccount' | transloco }}
        </pulpe-loading-button>

        @if (
          turnstileService.shouldRender() &&
          turnstileService.shouldUseTurnstile()
        ) {
          <ngx-turnstile
            #turnstileWidget
            [siteKey]="turnstileService.siteKey()"
            [appearance]="'interaction-only'"
            [theme]="'auto'"
            (resolved)="turnstileService.handleResolved($event)"
            (errored)="turnstileService.handleError()"
            class="hidden"
          />
        }

        <div class="flex items-center gap-4 my-0.5" aria-hidden="true">
          <div class="flex-1 h-px bg-outline-variant/40"></div>
          <span
            class="text-label-small font-semibold text-on-surface-variant/70 uppercase tracking-[0.2em]"
            >{{ 'common.or' | transloco }}</span
          >
          <div class="flex-1 h-px bg-outline-variant/40"></div>
        </div>

        <pulpe-oauth-provider-button
          class="w-full"
          [provider]="'apple'"
          testId="apple-oauth-button"
          [disabled]="isLoading()"
          (authError)="onOAuthError($event)"
          (loadingChange)="onOAuthLoadingChange('apple', $event)"
        />

        <pulpe-oauth-provider-button
          class="w-full"
          [provider]="'google'"
          testId="google-oauth-button"
          [disabled]="isLoading()"
          (authError)="onOAuthError($event)"
          (loadingChange)="onOAuthLoadingChange('google', $event)"
        />

        <button
          matButton="outlined"
          class="w-full !h-12"
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

        <pulpe-error-alert [message]="errorMessage()" class="w-full" />
      </div>

      <p
        class="text-sm text-on-surface-variant mt-6 flex items-center justify-center gap-1.5"
        data-testid="welcome-signin"
      >
        {{ 'welcome.alreadyAccount' | transloco }}
        <a
          [routerLink]="['/', ROUTES.LOGIN]"
          class="pulpe-inline-signin"
          data-testid="welcome-signin-link"
        >
          {{ 'welcome.signin' | transloco }}
          <mat-icon>arrow_forward</mat-icon>
        </a>
      </p>

      <p
        class="text-xs text-on-surface-variant/80 mt-5 leading-relaxed"
        data-testid="welcome-legal"
      >
        {{ 'welcome.legalPrefix' | transloco }}
        <a
          [routerLink]="['/', ROUTES.LEGAL, ROUTES.LEGAL_TERMS]"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary underline underline-offset-2"
          >{{ 'welcome.termsShort' | transloco }}</a
        >
        {{ 'welcome.legalAnd' | transloco }}
        <a
          [routerLink]="['/', ROUTES.LEGAL, ROUTES.LEGAL_PRIVACY]"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary underline underline-offset-2"
          >{{ 'welcome.privacyPolicy' | transloco }}</a
        >
      </p>
    </section>
  `,
})
export default class WelcomePage {
  readonly #demoInitializer = inject(DemoInitializerService);
  readonly #logger = inject(Logger);
  readonly #postHogService = inject(PostHogService);
  readonly #transloco = inject(TranslocoService);
  protected readonly turnstileService = inject(TurnstileService);
  protected readonly ROUTES = ROUTES;
  protected readonly BENEFITS = [
    { icon: 'event_note', labelKey: 'welcome.benefits.setup' },
    { icon: 'check_circle', labelKey: 'welcome.benefits.track' },
    { icon: 'lock', labelKey: 'welcome.benefits.privacy' },
  ] as const;

  constructor() {
    afterNextRender(() => {
      this.#postHogService.captureEvent('welcome_page_viewed');
    });
  }

  protected readonly errorMessage = signal('');
  protected readonly isOAuthLoading = signal(false);
  protected readonly isDemoInitializing = this.#demoInitializer.isInitializing;
  protected readonly isDemoLoading = computed(
    () => this.turnstileService.isProcessing() || this.isDemoInitializing(),
  );
  protected readonly isLoading = computed(
    () => this.isOAuthLoading() || this.isDemoLoading(),
  );

  protected readonly turnstileWidget =
    viewChild<NgxTurnstileComponent>('turnstileWidget');

  onOAuthLoadingChange(method: OAuthProvider, isLoading: boolean): void {
    this.isOAuthLoading.set(isLoading);
    if (isLoading) {
      this.#postHogService.setPendingSignupMethod(method);
      this.#postHogService.captureEvent('signup_started', { method });
    }
    // Pas de clear sur `false` : le succès OAuth émet loadingChange(false)
    // avant que le redirect n'emporte la page — effacer ici tue le
    // signup_completed lu au retour. La clé est consommée à la lecture
    // (capturePendingSignupCompleted) ; l'échec avéré passe par onOAuthError.
  }

  onOAuthError(message: string): void {
    this.errorMessage.set(message);
    this.#postHogService.clearPendingSignupMethod();
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
