import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  UrlTree,
} from '@angular/router';
import {
  OnboardingStore,
  STEP_ORDER,
  type OnboardingStep,
} from './onboarding-store';
import { ROUTES } from '../../core/routing';

/**
 * Vérifie si un revenu mensuel est valide pour les règles métier
 * @param income Le revenu à valider (peut être null)
 * @returns true si le revenu est valide, false sinon
 */
function isValidIncome(income: number | null): income is number {
  return income !== null && income > 0;
}

/**
 * Guard pour l'onboarding avec validation séquentielle complète.
 * Vérifie que les étapes obligatoires sont complétées dans l'ordre séquentiel
 * et empêche l'accès aux étapes suivantes sans compléter les précédentes.
 */
export const onboardingStepGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
): boolean | UrlTree => {
  const store = inject(OnboardingStore);
  const router = inject(Router);

  const currentStepPath = route.routeConfig?.path;

  // Garde de type pour s'assurer que currentStepPath est défini et valide
  if (!currentStepPath) {
    return true;
  }

  const currentStepIndex = STEP_ORDER.indexOf(
    currentStepPath as OnboardingStep,
  );

  // Si l'étape n'est pas dans STEP_ORDER, laisser passer (cas des routes inconnues)
  if (currentStepIndex === -1) {
    return true;
  }

  const data = store.data();

  // Validation séquentielle : vérifier que les étapes précédentes obligatoires sont complétées
  if (currentStepIndex >= 2) {
    // income et après (après personal-info)
    if (!data.firstName || data.firstName.trim() === '') {
      return router.createUrlTree([
        `/${ROUTES.ONBOARDING}/${ROUTES.ONBOARDING_PERSONAL_INFO}`,
      ]);
    }
  }

  if (currentStepIndex >= 3) {
    // housing et après (après income)
    if (!isValidIncome(data.monthlyIncome)) {
      return router.createUrlTree([
        `/${ROUTES.ONBOARDING}/${ROUTES.ONBOARDING_income}`,
      ]);
    }
  }

  // Validation spéciale pour l'étape d'inscription (doit avoir les données obligatoires)
  if (currentStepPath === 'registration') {
    if (
      !data.firstName ||
      data.firstName.trim() === '' ||
      !isValidIncome(data.monthlyIncome)
    ) {
      // Rediriger vers la première étape incomplète
      if (!data.firstName || data.firstName.trim() === '') {
        return router.createUrlTree([
          `/${ROUTES.ONBOARDING}/${ROUTES.ONBOARDING_PERSONAL_INFO}`,
        ]);
      }
      if (!isValidIncome(data.monthlyIncome)) {
        return router.createUrlTree([
          `/${ROUTES.ONBOARDING}/${ROUTES.ONBOARDING_income}`,
        ]);
      }
    }
  }

  return true;
};
