import { type Signal } from '@angular/core';
import { type OnboardingLayoutData } from './onboarding-layout-data';

export interface OnboardingStep {
  readonly onboardingLayoutData: OnboardingLayoutData;
  readonly canContinue: Signal<boolean>;
  readonly isSubmitting?: Signal<boolean>;
  onNext?(): Promise<void> | void;
}
