import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
  OnInit,
  OnDestroy,
  effect,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { OnboardingLayoutData } from '@features/onboarding/onboarding-step';
import { OnboardingApi } from '@features/onboarding/onboarding-api';
import { ONBOARDING_TOTAL_STEPS } from '../onboarding-constants';
import { OnboardingOrchestrator } from '../onboarding.orchestrator';
import { Subject, takeUntil } from 'rxjs';

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
export default class PersonalInfo implements OnInit, OnDestroy {
  private readonly onboardingApi = inject(OnboardingApi);
  private readonly router = inject(Router);
  private readonly orchestrator = inject(OnboardingOrchestrator);

  private readonly destroy$ = new Subject<void>();

  private readonly onboardingLayoutData: OnboardingLayoutData = {
    title: "Comment je dois t'appeler ?",
    subtitle:
      "Ton prénom va m'aider à savoir comment je vais devoir t'appeler tout au long de notre collaboration. Il ne sera en aucun cas communiqué.",
    currentStep: 1,
    totalSteps: ONBOARDING_TOTAL_STEPS,
  };

  public firstNameValue = signal<string>('');

  private readonly canContinue = computed(() => {
    return this.firstNameValue().trim().length > 0;
  });

  constructor() {
    effect(() => {
      this.orchestrator.canContinue.set(this.canContinue());
    });
    const existingFirstName = this.onboardingApi.getStateData().firstName;
    if (existingFirstName) {
      this.firstNameValue.set(existingFirstName);
    }
  }

  ngOnInit(): void {
    this.orchestrator.layoutData.set(this.onboardingLayoutData);

    this.orchestrator.nextClicked$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.router.navigate(['/onboarding/income']));

    this.orchestrator.previousClicked$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.router.navigate(['/onboarding/welcome']));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected onFirstNameChange(): void {
    const currentSteps = this.onboardingApi.getStateData();
    this.onboardingApi.updatePersonalInfoStep(
      this.firstNameValue(),
      currentSteps.email,
    );
  }
}
