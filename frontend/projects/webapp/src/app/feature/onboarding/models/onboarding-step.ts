import { Signal } from '@angular/core';

export interface OnboardingLayoutData {
  title: string;
  subtitle?: string;
  currentStep: number;
}

export interface OnboardingStep {
  readonly onboardingLayoutData: OnboardingLayoutData;
  readonly canContinue: Signal<boolean>;
  readonly isSubmitting?: Signal<boolean>;
  onNext?(): Promise<void> | void;
}
