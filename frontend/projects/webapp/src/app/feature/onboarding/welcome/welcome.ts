import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import {
  OnboardingCardComponent,
  OnboardingCardData,
} from '../../../ui/onboarding-card/onboarding-card';

@Component({
  selector: 'pulpe-welcome',
  standalone: true,
  imports: [OnboardingCardComponent, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <pulpe-onboarding-card
      [cardData]="cardData"
      [showPreviousButton]="false"
      [showProgress]="false"
      [nextButtonText]="'Commencer'"
      (next)="navigateNext()"
    >
      <!-- Logo Pulpe -->
      <div class="flex justify-center mb-6">
        <div class="w-48 h-48 pulpe-gradient rounded-full"></div>
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
          <button mat-button color="primary" class="ml-1">Se connecter</button>
        </p>
      </div>
    </pulpe-onboarding-card>
  `,
})
export default class WelcomeComponent {
  protected readonly cardData: OnboardingCardData = {
    title: '',
    currentStep: 0,
    totalSteps: 8,
  };

  constructor(private router: Router) {}

  protected navigateNext(): void {
    this.router.navigate(['/onboarding/personal-info']);
  }
}
