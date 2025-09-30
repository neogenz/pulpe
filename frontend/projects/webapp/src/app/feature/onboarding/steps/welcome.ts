import {
  Component,
  ChangeDetectionStrategy,
  signal,
  HostListener,
  inject,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { LottieComponent, type AnimationOptions } from 'ngx-lottie';
import { ROUTES } from '@core/routing';
import { DemoInitializerService } from '@core/demo';

@Component({
  selector: 'pulpe-welcome',
  imports: [MatButtonModule, MatIconModule, LottieComponent, RouterLink],
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
      <div class="flex gap-4 flex-col items-center justify-center w-full">
        <!-- Bouton Mode Démo avec style distinctif -->
        <button
          matButton="filled"
          class="w-full max-w-sm bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg transform transition-all hover:scale-105"
          data-testid="welcome-demo-button"
          (click)="onStartDemo()"
          [disabled]="isLoadingDemo()"
        >
          <mat-icon class="mr-2">play_circle</mat-icon>
          @if (isLoadingDemo()) {
            <span>Préparation de la démo...</span>
          } @else {
            <span>Essayer la démo</span>
          }
        </button>

        <div class="flex items-center gap-2 w-full max-w-sm">
          <div class="flex-1 h-px bg-outline-variant"></div>
          <span class="text-label-medium text-on-surface-variant px-2">ou</span>
          <div class="flex-1 h-px bg-outline-variant"></div>
        </div>

        <button
          matButton="filled"
          color="primary"
          class="w-full max-w-sm"
          data-testid="welcome-start-button"
          (click)="onContinue()"
        >
          Créer mon compte
        </button>

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
  protected readonly ROUTES = ROUTES;
  protected readonly isLoadingDemo = signal(false);

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

  #continueToNext(): void {
    this.#router.navigate([
      '/',
      ROUTES.ONBOARDING,
      ROUTES.ONBOARDING_PERSONAL_INFO,
    ]);
  }

  async onStartDemo(): Promise<void> {
    this.isLoadingDemo.set(true);
    try {
      await this.#demoInitializer.initializeDemoMode();
      // Note: pas besoin de remettre isLoadingDemo à false ici car on redirige
    } catch (error) {
      console.error('Erreur lors du démarrage du mode démo:', error);
      this.isLoadingDemo.set(false);
    }
  }
}
