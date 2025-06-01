import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import {
  OnboardingCardComponent,
  OnboardingCardData,
} from '../onboarding-card/onboarding-card';

@Component({
  selector: 'pulpe-personal-info',
  standalone: true,
  imports: [
    OnboardingCardComponent,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pulpe-onboarding-card
      [cardData]="cardData"
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

  protected onFirstNameChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.firstNameValue.set(target.value);
  }

  protected navigateNext(): void {
    this.router.navigate(['/onboarding/income']);
  }

  protected navigatePrevious(): void {
    this.router.navigate(['/onboarding/welcome']);
  }
}
