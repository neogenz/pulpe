import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { OnboardingLayoutData } from './models/onboarding-step';

@Injectable()
export class OnboardingOrchestrator {
  public layoutData = signal<OnboardingLayoutData | null>(null);
  public canContinue = signal<boolean>(false);
  public isSubmitting = signal<boolean>(false);

  public nextClicked$ = new Subject<void>();
  public previousClicked$ = new Subject<void>();
}
