import { Routes } from '@angular/router';
import { OnboardingApi } from './onboarding-api';

const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'welcome',
    providers: [OnboardingApi],
  },
  {
    path: 'welcome',
    loadComponent: () => import('./welcome/welcome'),
  },
  {
    path: 'housing',
    loadComponent: () => import('./housing/housing'),
  },
  {
    path: 'health-insurance',
    loadComponent: () => import('./health-insurance/health-insurance'),
  },
  {
    path: 'personal-info',
    loadComponent: () => import('./personal-info/personal-info'),
  },
  {
    path: 'phone-plan',
    loadComponent: () => import('./phone-plan/phone-plan'),
  },
  {
    path: 'transport',
    loadComponent: () => import('./transport/transport'),
  },
  {
    path: 'leasing-credit',
    loadComponent: () => import('./leasing-credit/leasing-credit'),
  },
  {
    path: 'income',
    loadComponent: () => import('./income/income'),
  },
  {
    path: 'registration',
    loadComponent: () => import('./registration/registration'),
  },
];

export default routes;
