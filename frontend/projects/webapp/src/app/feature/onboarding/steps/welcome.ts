import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  OnInit,
  effect,
  DestroyRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { OnboardingOrchestrator } from '../onboarding-orchestrator';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OnboardingLayoutData } from '../models/onboarding-layout-data';

@Component({
  selector: 'pulpe-welcome',
  standalone: true,
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <!-- Logo Pulpe -->
    <div class="flex justify-center mb-6">
      <div
        class="w-24 h-24 sm:w-32 sm:h-32 md:w-48 md:h-48 pulpe-gradient rounded-full"
      ></div>
    </div>

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
    </div>
  `,
})
export default class Welcome implements OnInit {
  readonly #router = inject(Router);
  readonly #orchestrator = inject(OnboardingOrchestrator);
  readonly #destroyRef = inject(DestroyRef);

  readonly #onboardingLayoutData: OnboardingLayoutData = {
    title: '',
    subtitle: '',
    currentStep: 0,
  };

  readonly #canContinue = computed(() => true);

  constructor() {
    effect(() => {
      this.#orchestrator.canContinue.set(this.#canContinue());
    });
  }

  ngOnInit(): void {
    this.#orchestrator.layoutData.set(this.#onboardingLayoutData);

    this.#orchestrator.nextClicked$
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => this.#router.navigate(['/onboarding/personal-info']));
  }
}
