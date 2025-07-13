import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
  effect,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import {
  OnboardingStore,
  type OnboardingLayoutData,
} from '../onboarding-store';

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

      <div class="flex justify-between">
        <button
          type="button"
          class="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
          (click)="goToPrevious()"
        >
          Précédent
        </button>
        <button
          type="button"
          class="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          [disabled]="!canContinue()"
          (click)="goToNext()"
        >
          Suivant
        </button>
      </div>
    </div>
  `,
})
export default class PersonalInfo {
  readonly #onboardingStore = inject(OnboardingStore);
  readonly #router = inject(Router);

  readonly #onboardingLayoutData: OnboardingLayoutData = {
    title: "Comment je dois t'appeler ?",
    subtitle:
      "Ton prénom va m'aider à savoir comment je vais devoir t'appeler tout au long de notre collaboration. Il ne sera en aucun cas communiqué.",
    currentStep: 1,
  };

  public firstNameValue = signal<string>('');

  readonly canContinue = computed(() => {
    return this.firstNameValue().trim().length > 0;
  });

  constructor() {
    effect(() => {
      this.#onboardingStore.setCanContinue(this.canContinue());
      this.#onboardingStore.setLayoutData(this.#onboardingLayoutData);
    });

    const existingFirstName = this.#onboardingStore.data().firstName;
    if (existingFirstName) {
      this.firstNameValue.set(existingFirstName);
    }
  }

  protected onFirstNameChange(): void {
    this.#onboardingStore.updateField('firstName', this.firstNameValue());
  }

  protected goToNext(): void {
    if (this.canContinue()) {
      this.#router.navigate(['/onboarding/income']);
    }
  }

  protected goToPrevious(): void {
    this.#router.navigate(['/onboarding/welcome']);
  }
}
