import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Navigation } from '@core/navigation';
import {
  OnboardingLayout,
  OnboardingLayoutData,
} from '@features/onboarding/onboarding-layout';

@Component({
  selector: 'pulpe-welcome',
  standalone: true,
  imports: [OnboardingLayout, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <pulpe-onboarding-layout
      [onboardingLayoutData]="onboardingLayoutData"
      [showPreviousButton]="false"
      [showProgress]="false"
      [nextButtonText]="'Commencer'"
      (next)="navigateNext()"
    >
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

      <!-- Lien de connexion -->
      <div slot="footer" class="text-center mt-6">
        <p class="text-body-medium text-on-surface-variant">
          Tu as déjà un compte ?
          <button
            mat-button
            color="primary"
            class="ml-1"
            (click)="navigateToLogin()"
          >
            Se connecter
          </button>
        </p>
      </div>
    </pulpe-onboarding-layout>
  `,
})
export default class Welcome {
  readonly #navigation = inject(Navigation);

  protected readonly onboardingLayoutData: OnboardingLayoutData = {
    title: '',
    currentStep: 0,
    totalSteps: 8,
  };

  protected navigateNext(): void {
    this.#navigation.navigateTo('onboarding/personal-info');
  }

  protected navigateToLogin(): void {
    this.#navigation.navigateToLogin();
  }
}
