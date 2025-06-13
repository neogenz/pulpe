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
import { OnboardingLayoutData } from '@features/onboarding/onboarding-layout';
import { OnboardingApi } from '@features/onboarding/onboarding-api';
import { ONBOARDING_TOTAL_STEPS } from '../onboarding-constants';

@Component({
  selector: 'pulpe-personal-info',
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <mat-form-field class="w-full" appearance="fill">
        <mat-label>Prénom</mat-label>
        <input
          matInput
          [(ngModel)]="firstNameValue"
          (ngModelChange)="onFirstNameChange()"
          placeholder="Quel est ton prénom ?"
        />
        <mat-icon matPrefix>person</mat-icon>
      </mat-form-field>
    </div>
  `,
})
export default class PersonalInfo {
  private readonly onboardingApi = inject(OnboardingApi);

  public readonly onboardingLayoutData: OnboardingLayoutData = {
    title: "Comment je dois t'appeler ?",
    subtitle:
      "Ton prénom va m'aider à savoir comment je vais devoir t'appeler tout au long de notre collaboration. Il ne sera en aucun cas communiqué.",
    currentStep: 1,
    totalSteps: ONBOARDING_TOTAL_STEPS,
  };

  public firstNameValue = signal<string>('');

  constructor() {
    const existingFirstName = this.onboardingApi.getStateData().firstName;
    if (existingFirstName) {
      this.firstNameValue.set(existingFirstName);
    }
  }

  public canContinue = computed(() => {
    return this.firstNameValue().trim().length > 0;
  });

  protected onFirstNameChange(): void {
    const currentSteps = this.onboardingApi.getStateData();
    this.onboardingApi.updatePersonalInfoStep(
      this.firstNameValue(),
      currentSteps.email,
    );
  }
}
