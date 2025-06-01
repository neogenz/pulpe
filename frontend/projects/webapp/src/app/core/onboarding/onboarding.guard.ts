import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, map } from 'rxjs';
import { OnboardingApi } from '../../feature/onboarding/onboarding-api';

@Injectable({
  providedIn: 'root',
})
export class OnboardingCompletedGuard implements CanActivate {
  constructor(
    private onboardingApi: OnboardingApi,
    private router: Router,
  ) {}

  canActivate(): Observable<boolean> {
    return this.onboardingApi.checkOnboardingStatus().pipe(
      map((isCompleted) => {
        if (!isCompleted) {
          this.router.navigate(['/onboarding']);
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
  constructor(
    private onboardingApi: OnboardingApi,
    private router: Router,
  ) {}

  canActivate(): Observable<boolean> {
    return this.onboardingApi.checkOnboardingStatus().pipe(
      map((isCompleted) => {
        if (isCompleted) {
          this.router.navigate(['/app']);
          return false;
        }
        return true;
      }),
    );
  }
}
