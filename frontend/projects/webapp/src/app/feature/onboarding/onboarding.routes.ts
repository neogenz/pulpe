import { Routes } from '@angular/router';
import { OnboardingLayout } from './onboarding-layout';

const routes: Routes = [
  {
    path: '',
    component: OnboardingLayout,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'welcome',
      },
      {
        path: 'welcome',
        loadComponent: () => import('./welcome/welcome'),
      },
      {
        path: 'personal-info',
        loadComponent: () => import('./personal-info/personal-info'),
      },
      {
        path: 'housing',
        loadComponent: () => import('./housing/housing'),
      },
      {
        path: 'income',
        loadComponent: () => import('./income/income'),
      },
      {
        path: 'health-insurance',
        loadComponent: () => import('./health-insurance/health-insurance'),
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
        path: 'registration',
        loadComponent: () => import('./registration/registration'),
      },
    ],
  },
];

export default routes;
