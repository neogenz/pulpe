import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { OnboardingApi } from '../../feature/onboarding/onboarding-api';

@Injectable({
  providedIn: 'root',
})
export class OnboardingRedirectService {
  constructor(
    private onboardingApi: OnboardingApi,
    private router: Router,
  ) {}

  redirectBasedOnOnboardingStatus(): Observable<boolean> {
    return this.onboardingApi.checkOnboardingStatus().pipe(
      tap((isCompleted) => {
        if (isCompleted) {
          this.router.navigate(['/app']);
        } else {
          this.router.navigate(['/onboarding']);
        }
      }),
    );
  }

  redirectToAppIfCompleted(): Observable<boolean> {
    return this.onboardingApi.checkOnboardingStatus().pipe(
      tap((isCompleted) => {
        if (isCompleted) {
          this.router.navigate(['/app']);
        }
      }),
    );
  }

  redirectToOnboardingIfNotCompleted(): Observable<boolean> {
    return this.onboardingApi.checkOnboardingStatus().pipe(
      tap((isCompleted) => {
        if (!isCompleted) {
          this.router.navigate(['/onboarding']);
        }
      }),
    );
  }
}
