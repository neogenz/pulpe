import { type Routes } from '@angular/router';
import { OnboardingStore, STEP_ORDER } from './onboarding-store';
import { PAGE_TITLES, ROUTES } from '@core/routing';
import { onboardingStepGuard } from './onboarding-step-guard';
import { OnboardingApi } from './services/onboarding-api';

const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./onboarding-layout'),
    providers: [OnboardingStore, OnboardingApi],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: ROUTES.ONBOARDING_WELCOME,
      },
      {
        path: STEP_ORDER[0],
        title: PAGE_TITLES.WELCOME,
        loadComponent: () => import('./steps/welcome'),
      },
      {
        path: STEP_ORDER[1],
        title: PAGE_TITLES.PERSONAL_INFO,
        loadComponent: () => import('./steps/personal-info'),
        canActivate: [onboardingStepGuard],
      },
      {
        path: STEP_ORDER[2],
        title: PAGE_TITLES.income,
        loadComponent: () => import('./steps/income'),
        canActivate: [onboardingStepGuard],
      },
      {
        path: STEP_ORDER[3],
        title: PAGE_TITLES.HOUSING,
        loadComponent: () => import('./steps/housing'),
        canActivate: [onboardingStepGuard],
      },
      {
        path: STEP_ORDER[4],
        title: PAGE_TITLES.HEALTH_INSURANCE,
        loadComponent: () => import('./steps/health-insurance'),
        canActivate: [onboardingStepGuard],
      },
      {
        path: STEP_ORDER[5],
        title: PAGE_TITLES.PHONE_PLAN,
        loadComponent: () => import('./steps/phone-plan'),
        canActivate: [onboardingStepGuard],
      },
      {
        path: STEP_ORDER[6],
        title: PAGE_TITLES.TRANSPORT,
        loadComponent: () => import('./steps/transport'),
        canActivate: [onboardingStepGuard],
      },
      {
        path: STEP_ORDER[7],
        title: PAGE_TITLES.LEASING_CREDIT,
        loadComponent: () => import('./steps/leasing-credit'),
        canActivate: [onboardingStepGuard],
      },
      {
        path: STEP_ORDER[8],
        title: PAGE_TITLES.REGISTRATION,
        loadComponent: () => import('./steps/registration'),
        canActivate: [onboardingStepGuard],
      },
    ],
  },
];

export default routes;
