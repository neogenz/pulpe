import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, switchMap, firstValueFrom } from 'rxjs';
import { AuthApi } from './auth-api';
import { OnboardingStatus } from '@core/user';
import { NAVIGATION_PATHS } from '@core/navigation';

@Injectable({
  providedIn: 'root',
})
export class AuthRedirectGuard implements CanActivate {
  readonly #authService = inject(AuthApi);
  readonly #router = inject(Router);
  readonly #onboardingStatus = inject(OnboardingStatus);

  canActivate(): Observable<boolean> {
    return this.#authService.authState$.pipe(
      switchMap(async (authState) => {
        // Si l'utilisateur est connecté, le rediriger
        if (authState.isAuthenticated && !authState.isLoading) {
          try {
            const isOnboardingCompleted = await firstValueFrom(
              this.#onboardingStatus.checkOnboardingCompletionStatus(
                authState.isAuthenticated,
              ),
            );

            if (isOnboardingCompleted) {
              this.#router.navigate([NAVIGATION_PATHS.CURRENT_MONTH]);
            } else {
              this.#router.navigate([NAVIGATION_PATHS.ONBOARDING]);
            }
          } catch (error) {
            console.error(
              "Erreur lors de la vérification du statut d'onboarding:",
              error,
            );
            this.#router.navigate([NAVIGATION_PATHS.ONBOARDING]);
          }
          return false;
        }
        // Si pas connecté ou en cours de chargement, permettre l'accès à login
        return true;
      }),
    );
  }
}
