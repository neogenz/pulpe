import { Signal } from '@angular/core';
import { OnboardingLayoutData } from './onboarding-layout-data';

export interface OnboardingStep {
  readonly onboardingLayoutData: OnboardingLayoutData;
  readonly canContinue: Signal<boolean>;
  readonly isSubmitting?: Signal<boolean>;
  onNext?(): Promise<void> | void;
}
