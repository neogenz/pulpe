import { Routes } from '@angular/router';
import { OnboardingPage } from './onboarding-page';
import { OnboardingOrchestrator } from './onboarding.orchestrator';
import { OnboardingApi } from './onboarding-api';

const routes: Routes = [
  {
    path: '',
    component: OnboardingPage,
    providers: [OnboardingOrchestrator, OnboardingApi],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'welcome',
      },
      {
        path: 'welcome',
        loadComponent: () => import('./steps/welcome/welcome'),
      },
      {
        path: 'personal-info',
        loadComponent: () => import('./steps/personal-info/personal-info'),
      },
      {
        path: 'housing',
        loadComponent: () => import('./steps/housing/housing'),
      },
      {
        path: 'income',
        loadComponent: () => import('./steps/income/income'),
      },
      {
        path: 'health-insurance',
        loadComponent: () =>
          import('./steps/health-insurance/health-insurance'),
      },
      {
        path: 'phone-plan',
        loadComponent: () => import('./steps/phone-plan/phone-plan'),
      },
      {
        path: 'transport',
        loadComponent: () => import('./steps/transport/transport'),
      },
      {
        path: 'leasing-credit',
        loadComponent: () => import('./steps/leasing-credit/leasing-credit'),
      },
      {
        path: 'registration',
        loadComponent: () => import('./steps/registration/registration'),
      },
    ],
  },
];

export default routes;
