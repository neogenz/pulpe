import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { ROUTES } from '@core/routing/routes-constants';
import { OnboardingLayoutData } from '@features/onboarding/onboarding-layout';

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
  `,
})
export default class Welcome {
  readonly #router = inject(Router);

  public readonly onboardingLayoutData: OnboardingLayoutData = {
    title: 'Bienvenue dans Pulpe',
    subtitle:
      "Pulpe regroupe tes revenus et dépenses pour te donner une vision nette et des conseils adaptés dès aujourd'hui.",
    currentStep: 0,
    totalSteps: 9,
  };

  protected navigateToLogin(): void {
    this.#router.navigate([ROUTES.LOGIN]);
  }
}
