import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import {
  OnboardingLayout,
  OnboardingLayoutData,
} from '@features/onboarding/onboarding-layout';
import { OnboardingApi } from '@core/onboarding/onboarding-api';
import { ONBOARDING_TOTAL_STEPS } from '../onboarding-constants';

@Component({
  selector: 'pulpe-personal-info',
  standalone: true,
  imports: [
    OnboardingLayout,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pulpe-onboarding-layout
      [onboardingLayoutData]="onboardingLayoutData"
      [canContinue]="canContinue()"
      (next)="navigateNext()"
      (previous)="navigatePrevious()"
    >
      <div class="space-y-6">
        <mat-form-field class="w-full" appearance="fill">
          <mat-label>Prénom</mat-label>
          <input
            matInput
            [value]="firstNameValue()"
            (input)="onFirstNameChange($event)"
            placeholder="Quel est ton prénom ?"
          />
          <mat-icon matPrefix>person</mat-icon>
        </mat-form-field>
      </div>
    </pulpe-onboarding-layout>
  `,
})
export default class PersonalInfo {
  private readonly router = inject(Router);
  private readonly onboardingApi = inject(OnboardingApi);

  protected readonly onboardingLayoutData: OnboardingLayoutData = {
    title: "Comment je dois t'appeler ?",
    subtitle:
      "Ton prénom va m'aider à savoir comment je vais devoir t'appeler tout au long de notre collaboration. Il ne sera en aucun cas communiqué.",
    currentStep: 1,
    totalSteps: ONBOARDING_TOTAL_STEPS,
  };

  protected firstNameValue = signal<string>('');

  constructor() {
    const existingFirstName = this.onboardingApi.onboardingSteps().firstName;
    if (existingFirstName) {
      this.firstNameValue.set(existingFirstName);
    }
  }

  protected canContinue(): boolean {
    return this.firstNameValue().trim().length > 0;
  }

  protected onFirstNameChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.firstNameValue.set(target.value);
  }

  protected navigateNext(): void {
    const currentSteps = this.onboardingApi.onboardingSteps();
    this.onboardingApi.updatePersonalInfoStep(
      this.firstNameValue(),
      currentSteps.email,
    );
    this.router.navigate(['/onboarding/income']);
  }

  protected navigatePrevious(): void {
    this.router.navigate(['/onboarding/welcome']);
  }
}
