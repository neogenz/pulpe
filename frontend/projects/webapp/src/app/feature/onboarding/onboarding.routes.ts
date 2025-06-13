import { Routes } from '@angular/router';
import { OnboardingLayout } from './onboarding-layout';
import { OnboardingOrchestrator } from './onboarding-orchestrator';
import { OnboardingApi } from './onboarding-api';

const routes: Routes = [
  {
    path: '',
    component: OnboardingLayout,
    providers: [OnboardingOrchestrator, OnboardingApi],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'welcome',
      },
      {
        path: 'welcome',
        loadComponent: () => import('./steps/welcome'),
      },
      {
        path: 'personal-info',
        loadComponent: () => import('./steps/personal-info'),
      },
      {
        path: 'housing',
        loadComponent: () => import('./steps/housing'),
      },
      {
        path: 'income',
        loadComponent: () => import('./steps/income'),
      },
      {
        path: 'health-insurance',
        loadComponent: () => import('./steps/health-insurance'),
      },
      {
        path: 'phone-plan',
        loadComponent: () => import('./steps/phone-plan'),
      },
      {
        path: 'transport',
        loadComponent: () => import('./steps/transport'),
      },
      {
        path: 'leasing-credit',
        loadComponent: () => import('./steps/leasing-credit'),
      },
      {
        path: 'registration',
        loadComponent: () => import('./steps/registration'),
      },
    ],
  },
];

export default routes;
