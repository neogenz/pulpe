import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  effect,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { LottieComponent } from 'ngx-lottie';
import { AnimationOptions } from 'ngx-lottie';
import {
  OnboardingStore,
  type OnboardingLayoutData,
} from '../onboarding-store';

@Component({
  selector: 'pulpe-welcome',
  imports: [MatButtonModule, LottieComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <!-- Logo Pulpe avec animation Lottie différée -->

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
        <div class="w-24 h-24 bg-primary/10 rounded-full animate-pulse"></div>
      </div>
    } @loading {
      <div
        class="flex justify-center mb-6 md:w-80 md:h-80 mt-[-86px] md:mt-[-100px] items-center"
      >
        <div class="w-24 h-24 bg-primary/20 rounded-full animate-pulse"></div>
      </div>
    } @error {
      <div
        class="flex justify-center mb-6 md:w-80 md:h-80 mt-[-86px] md:mt-[-100px] items-center"
      >
        <span class="text-on-surface-variant text-4xl">🎨</span>
      </div>
    }

    <!-- Contenu -->
    <div class="text-center space-y-4">
      <h2 class="text-display-small text-on-surface">
        Bienvenue dans Pulpe,<br />
        commençons
      </h2>
      <p class="text-body-large text-on-surface-variant leading-relaxed px-4">
        Pulpe regroupe tes revenus et dépenses pour te donner une vision nette
        et des conseils adaptés dès aujourd'hui.
      </p>

      <div class="flex justify-center mt-8">
        <button
          type="button"
          class="px-6 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 text-lg font-medium"
          (click)="goToNext()"
        >
          Commencer
        </button>
      </div>
    </div>
  `,
})
export default class Welcome {
  readonly #onboardingStore = inject(OnboardingStore);
  readonly #router = inject(Router);

  readonly #onboardingLayoutData: OnboardingLayoutData = {
    title: '',
    subtitle: '',
    currentStep: 0,
  };

  readonly canContinue = computed(() => true);

  readonly lottieOptions = signal<AnimationOptions>({
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

  constructor() {
    effect(() => {
      this.#onboardingStore.setCanContinue(this.canContinue());
      this.#onboardingStore.setLayoutData(this.#onboardingLayoutData);
    });
  }

  protected goToNext(): void {
    this.#router.navigate(['/onboarding/personal-info']);
  }
}
