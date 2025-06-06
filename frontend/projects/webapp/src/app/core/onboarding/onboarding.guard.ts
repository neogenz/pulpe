import { Injectable, inject } from '@angular/core';
import { CanActivate } from '@angular/router';
import { Observable, map } from 'rxjs';
import { Navigation } from '@core/navigation';
import { OnboardingApi } from './onboarding-api';

@Injectable({
  providedIn: 'root',
})
export class OnboardingCompletedGuard implements CanActivate {
  readonly #onboardingApi = inject(OnboardingApi);
  readonly #navigation = inject(Navigation);

  canActivate(): Observable<boolean> {
    return this.#onboardingApi.checkOnboardingCompletionStatus().pipe(
      map((isCompleted) => {
        if (!isCompleted) {
          this.#navigation.navigateToOnboarding();
          return false;
        }
        return true;
      }),
    );
  }
}

@Injectable({
  providedIn: 'root',
})
export class OnboardingRedirectGuard implements CanActivate {
  readonly #onboardingApi = inject(OnboardingApi);
  readonly #navigation = inject(Navigation);

  canActivate(): Observable<boolean> {
    return this.#onboardingApi.checkOnboardingCompletionStatus().pipe(
      map((isCompleted) => {
        if (isCompleted) {
          this.#navigation.navigateToApp();
          return false;
        }
        return true;
      }),
    );
  }
}
