import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { OnboardingStore } from './onboarding-store';

/**
 * Guard simplifié pour l'onboarding.
 * Vérifie seulement que les étapes obligatoires (prénom et revenus) sont complétées
 * avant d'accéder à l'étape d'inscription.
 */
export const onboardingStepGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
) => {
  const store = inject(OnboardingStore);
  const router = inject(Router);

  const currentStepPath = route.routeConfig?.path;

  // Si c'est l'étape d'inscription, vérifier que les données obligatoires sont remplies
  if (currentStepPath === 'registration') {
    const data = store.data();

    if (!data.firstName || !data.monthlyIncome || data.monthlyIncome <= 0) {
      // Rediriger vers la première étape incomplète
      if (!data.firstName) {
        return router.createUrlTree(['/onboarding/personal-info']);
      }
      if (!data.monthlyIncome || data.monthlyIncome <= 0) {
        return router.createUrlTree(['/onboarding/income']);
      }
    }
  }

  return true;
};
