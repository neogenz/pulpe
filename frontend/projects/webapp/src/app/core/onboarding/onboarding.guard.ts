import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, map } from 'rxjs';
import { NAVIGATION_PATHS } from '@core/navigation';
import { OnboardingStatus } from '@core/user';
import { AuthApi } from '@core/auth';

@Injectable({
  providedIn: 'root',
})
export class OnboardingCompletedGuard implements CanActivate {
  readonly #onboardingStatus = inject(OnboardingStatus);
  readonly #router = inject(Router);
  readonly #authApi = inject(AuthApi);

  canActivate(): Observable<boolean> {
    return this.#onboardingStatus
      .checkOnboardingCompletionStatus(this.#authApi.isAuthenticated)
      .pipe(
        map((isCompleted) => {
          if (!isCompleted) {
            this.#router.navigate([NAVIGATION_PATHS.ONBOARDING]);
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
  readonly #onboardingStatus = inject(OnboardingStatus);
  readonly #router = inject(Router);
  readonly #authApi = inject(AuthApi);

  canActivate(): Observable<boolean> {
    return this.#onboardingStatus
      .checkOnboardingCompletionStatus(this.#authApi.isAuthenticated)
      .pipe(
        map((isCompleted) => {
          if (isCompleted) {
            this.#router.navigate([NAVIGATION_PATHS.CURRENT_MONTH]);
            return false;
          }
          return true;
        }),
      );
  }
}
