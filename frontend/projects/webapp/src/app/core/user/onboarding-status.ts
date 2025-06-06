import { Injectable, inject } from '@angular/core';
import { Observable, of, catchError, map } from 'rxjs';
import { UserApi } from './user-api';

const ONBOARDING_STATUS_KEY = 'pulpe-onboarding-completed';

@Injectable({
  providedIn: 'root',
})
export class OnboardingStatus {
  readonly #userApi = inject(UserApi);

  checkOnboardingCompletionStatus(
    isAuthenticated: boolean,
  ): Observable<boolean> {
    // Si l'utilisateur n'est pas connecté, retourner false
    if (!isAuthenticated) {
      return of(false);
    }

    // Vérifier d'abord le localStorage pour la performance
    try {
      const localCompleted =
        localStorage.getItem(ONBOARDING_STATUS_KEY) === 'true';
      if (localCompleted) {
        return of(true);
      }
    } catch (error) {
      console.warn('Failed to check localStorage onboarding status:', error);
    }

    // Si pas dans localStorage, vérifier côté serveur
    return this.#userApi.getOnboardingStatus().pipe(
      map((response) => {
        if (response.success && response.onboardingCompleted) {
          // Mettre à jour le localStorage si l'onboarding est terminé côté serveur
          try {
            localStorage.setItem(ONBOARDING_STATUS_KEY, 'true');
          } catch (error) {
            console.warn('Failed to update localStorage:', error);
          }
        }
        return response.success && response.onboardingCompleted;
      }),
      catchError((error) => {
        console.error('Failed to check onboarding completion status:', error);
        return of(false);
      }),
    );
  }

  markOnboardingAsCompletedLocally(): void {
    try {
      localStorage.setItem(ONBOARDING_STATUS_KEY, 'true');
    } catch (error) {
      console.warn('Failed to mark onboarding as completed locally:', error);
    }
  }

  clearOnboardingStatus(): void {
    try {
      localStorage.removeItem(ONBOARDING_STATUS_KEY);
    } catch (error) {
      console.warn('Failed to clear onboarding status:', error);
    }
  }
}
