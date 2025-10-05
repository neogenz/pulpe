import {
  Component,
  ChangeDetectionStrategy,
  signal,
  HostListener,
  inject,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { LottieComponent, type AnimationOptions } from 'ngx-lottie';
import { ROUTES } from '@core/routing';
import { DemoInitializerService } from '@core/demo/demo-initializer.service';
import { Logger } from '@core/logging/logger';

@Component({
  selector: 'pulpe-welcome',
  imports: [
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatProgressSpinnerModule,
    LottieComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex flex-col items-center justify-center h-full gap-10"
      data-testid="onboarding-welcome-page"
    >
      <div class="text-center">
        <h1 class="text-headline-large text-on-surface">
          Bienvenue dans Pulpe
        </h1>

        @defer (on idle) {
          <div class="flex justify-center mb-6">
            <ng-lottie
              [options]="lottieOptions()"
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

        <p class="text-body-large text-on-surface-variant leading-relaxed px-4">
          Pulpe regroupe tes revenus et dépenses pour te donner une vision nette
          et des conseils adaptés dès aujourd'hui.
        </p>
      </div>
      <div
        class="flex gap-4 flex-col items-center justify-between w-full flex-1"
      >
        <div class="flex gap-4 flex-col items-center w-full">
          <button
            matButton="filled"
            color="primary"
            class="w-full max-w-sm"
            data-testid="welcome-start-button"
            (click)="onContinue()"
          >
            Commencer
          </button>

          <button
            matButton="tonal"
            type="button"
            data-testid="demo-mode-button"
            class="w-full max-w-sm"
            [disabled]="isDemoInitializing()"
            (click)="startDemoMode()"
          >
            @if (isDemoInitializing()) {
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
    </div>
  `,
})
export default class Welcome {
  readonly #router = inject(Router);
  readonly #demoInitializer = inject(DemoInitializerService);
  readonly #logger = inject(Logger);
  protected readonly ROUTES = ROUTES;

  protected demoErrorMessage = signal<string>('');
  protected isDemoInitializing = this.#demoInitializer.isInitializing;

  protected readonly lottieOptions = signal<AnimationOptions>({
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
  });

  @HostListener('keydown.enter')
  onEnter(): void {
    this.#continueToNext();
  }

  onContinue(): void {
    this.#continueToNext();
  }

  async startDemoMode(): Promise<void> {
    this.demoErrorMessage.set('');

    try {
      await this.#demoInitializer.startDemoSession();
      // Navigation is handled by the service
    } catch (error) {
      this.#logger.error('Failed to start demo mode', { error });
      this.demoErrorMessage.set(
        'Impossible de démarrer le mode démo. Veuillez réessayer.',
      );
    }
  }

  #continueToNext(): void {
    this.#router.navigate([
      '/',
      ROUTES.ONBOARDING,
      ROUTES.ONBOARDING_PERSONAL_INFO,
    ]);
  }
}
