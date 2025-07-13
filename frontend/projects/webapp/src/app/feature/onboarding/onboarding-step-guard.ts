import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { OnboardingStore } from './onboarding-store';

/**
 * Guard to prevent users from skipping onboarding steps.
 * Ensures that required previous steps are completed before allowing access to the next step.
 */
export const onboardingStepGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
) => {
  const onboardingStore = inject(OnboardingStore);
  const router = inject(Router);

  const currentStepPath = route.routeConfig?.path;
  if (!currentStepPath) {
    return true; // Allow navigation if path is not defined
  }

  // Get the current step index based on the route path
  const stepIndex = onboardingStore.stepOrder.indexOf(currentStepPath);

  if (stepIndex === -1) {
    return true; // Allow navigation if step is not in the order (like welcome)
  }

  // Welcome step is always accessible
  if (stepIndex === 0) {
    return true;
  }

  // Check if all required previous steps are completed
  const canAccess = onboardingStore.canAccessStep(stepIndex);

  if (!canAccess) {
    // Find the first incomplete required step
    const firstIncompleteStep =
      onboardingStore.getFirstIncompleteRequiredStep();
    const redirectPath = firstIncompleteStep
      ? `/onboarding/${firstIncompleteStep}`
      : '/onboarding/welcome';

    return router.createUrlTree([redirectPath]);
  }

  return true;
};
