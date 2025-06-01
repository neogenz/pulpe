import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  OnboardingCardComponent,
  OnboardingCardData,
} from '../../../ui/onboarding-card/onboarding-card';
import { TextInputComponent } from '../../../ui/text-input/text-input';

@Component({
  selector: 'pulpe-personal-info',
  standalone: true,
  imports: [OnboardingCardComponent, TextInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pulpe-onboarding-card
      [cardData]="cardData"
      [canContinue]="canContinue()"
      (next)="navigateNext()"
      (previous)="navigatePrevious()"
    >
      <div class="space-y-6">
        <pulpe-text-input
          [value]="firstNameValue()"
          [icon]="true"
          placeholder="Prénom"
          (valueChange)="onFirstNameChange($event)"
        >
          <span slot="icon" class="material-icons text-gray-500">person</span>
        </pulpe-text-input>
      </div>
    </pulpe-onboarding-card>
  `,
})
export default class PersonalInfoComponent {
  protected readonly cardData: OnboardingCardData = {
    title: "Comment je dois t'appeler ?",
    subtitle:
      "Ton prénom va m'aider à savoir comment je vais devoir t'appeler tout au long de notre collaboration. Il ne sera en aucun cas communiqué.",
    currentStep: 1,
    totalSteps: 8,
  };

  protected firstNameValue = signal<string>('');

  constructor(private router: Router) {}

  protected canContinue(): boolean {
    return this.firstNameValue().trim().length > 0;
  }

  protected onFirstNameChange(value: string): void {
    this.firstNameValue.set(value);
  }

  protected navigateNext(): void {
    this.router.navigate(['/onboarding/income']);
  }

  protected navigatePrevious(): void {
    this.router.navigate(['/onboarding/welcome']);
  }
}
