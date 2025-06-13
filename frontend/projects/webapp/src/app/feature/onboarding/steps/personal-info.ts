import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
  OnInit,
  effect,
  DestroyRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { OnboardingLayoutData } from '../models/onboarding-step';
import { OnboardingApi } from '../onboarding-api';
import { OnboardingOrchestrator } from '../onboarding-orchestrator';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
export default class PersonalInfo implements OnInit {
  readonly #onboardingApi = inject(OnboardingApi);
  readonly #router = inject(Router);
  readonly #orchestrator = inject(OnboardingOrchestrator);
  readonly #destroyRef = inject(DestroyRef);

  readonly #onboardingLayoutData: OnboardingLayoutData = {
    title: "Comment je dois t'appeler ?",
    subtitle:
      "Ton prénom va m'aider à savoir comment je vais devoir t'appeler tout au long de notre collaboration. Il ne sera en aucun cas communiqué.",
    currentStep: 1,
  };

  public firstNameValue = signal<string>('');

  readonly #canContinue = computed(() => {
    return this.firstNameValue().trim().length > 0;
  });

  constructor() {
    effect(() => {
      this.#orchestrator.canContinue.set(this.#canContinue());
    });
    const existingFirstName = this.#onboardingApi.getStateData().firstName;
    if (existingFirstName) {
      this.firstNameValue.set(existingFirstName);
    }
  }

  ngOnInit(): void {
    this.#orchestrator.layoutData.set(this.#onboardingLayoutData);

    this.#orchestrator.nextClicked$
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => this.#router.navigate(['/onboarding/income']));

    this.#orchestrator.previousClicked$
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => this.#router.navigate(['/onboarding/welcome']));
  }

  protected onFirstNameChange(): void {
    const currentSteps = this.#onboardingApi.getStateData();
    this.#onboardingApi.updatePersonalInfoStep(
      this.firstNameValue(),
      currentSteps.email,
    );
  }
}
