import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { OnboardingLayout } from '@features/onboarding/onboarding-layout';
import { OnboardingApi } from '@features/onboarding/onboarding-api';
import { ONBOARDING_TOTAL_STEPS } from '../onboarding-constants';
import { OnboardingLayoutData } from '../onboarding-layout';

@Component({
  selector: 'pulpe-registration',
  standalone: true,
  imports: [
    OnboardingLayout,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <mat-form-field class="w-full" appearance="fill">
        <mat-label>Email</mat-label>
        <input
          matInput
          type="email"
          placeholder="Email"
          required
          [(ngModel)]="emailValue"
          (ngModelChange)="updateOnboardingEmail()"
        />
        <mat-icon matPrefix>email</mat-icon>
      </mat-form-field>

      <mat-form-field class="w-full" appearance="fill">
        <mat-label>Mot de passe</mat-label>
        <input
          matInput
          [type]="hidePassword() ? 'password' : 'text'"
          placeholder="Mot de passe"
          required
          [(ngModel)]="passwordValue"
        />
        <mat-icon matPrefix>lock</mat-icon>
        <button
          matIconButton
          matSuffix
          type="button"
          (click)="hidePassword.set(!hidePassword())"
          [attr.aria-label]="'Afficher le mot de passe'"
          [attr.aria-pressed]="!hidePassword()"
        >
          <mat-icon>{{
            hidePassword() ? 'visibility_off' : 'visibility'
          }}</mat-icon>
        </button>
        <mat-hint
          >Le mot de passe doit contenir au minimum 8 caractères</mat-hint
        >
      </mat-form-field>
    </div>
  `,
})
export default class Registration {
  #onboardingApi = inject(OnboardingApi);

  public readonly onboardingLayoutData: OnboardingLayoutData = {
    title: 'Presque fini !',
    subtitle: 'Créez votre compte pour accéder à votre budget personnalisé.',
    currentStep: 8,
    totalSteps: ONBOARDING_TOTAL_STEPS,
  };

  public emailValue = signal<string>('');
  public passwordValue = signal<string>('');
  protected hidePassword = signal<boolean>(true);

  public canContinue = computed(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmailValid = emailRegex.test(this.emailValue());
    const isPasswordValid = this.passwordValue().length >= 8;
    return isEmailValid && isPasswordValid;
  });

  constructor() {
    const currentEmail = this.#onboardingApi.getStateData().email;
    if (currentEmail) {
      this.emailValue.set(currentEmail);
    }
  }

  protected updateOnboardingEmail(): void {
    const currentSteps = this.#onboardingApi.getStateData();
    this.#onboardingApi.updatePersonalInfoStep(
      currentSteps.firstName,
      this.emailValue(),
    );
  }
}
