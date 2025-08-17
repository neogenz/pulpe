import {
  Component,
  ChangeDetectionStrategy,
  signal,
  HostListener,
  inject,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';
import { ROUTES } from '@core/routing';

@Component({
  selector: 'pulpe-welcome',
  imports: [MatButtonModule, LottieComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center h-full gap-10">
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
  protected readonly ROUTES = ROUTES;

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
}
