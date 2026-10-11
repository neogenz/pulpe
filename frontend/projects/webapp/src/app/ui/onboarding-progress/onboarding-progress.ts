import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { StepProgress } from '@ui/step-progress';

type OnboardingStep = 1 | 2 | 3;

@Component({
  selector: 'pulpe-onboarding-progress',
  imports: [StepProgress, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
  `,
  template: `
    <pulpe-step-progress
      testId="onboarding-journey"
      [steps]="steps"
      [currentStep]="currentStep()"
      [ariaLabel]="
        'auth.onboarding.progressAriaLabel'
          | transloco: { current: currentStep() }
      "
    />
  `,
})
export class OnboardingProgress {
  readonly currentStep = input.required<OnboardingStep>();

  protected readonly steps = [
    { labelKey: 'auth.onboarding.accountStep' },
    { labelKey: 'auth.onboarding.securityStep' },
    {
      labelKey: 'auth.onboarding.budgetStep',
      shortLabelKey: 'auth.onboarding.budgetStepShort',
    },
  ] as const;
}
