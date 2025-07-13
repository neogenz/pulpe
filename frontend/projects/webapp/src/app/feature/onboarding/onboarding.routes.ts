import { Routes } from '@angular/router';
import { OnboardingLayout } from './onboarding-layout';
import { OnboardingStore } from './onboarding-store';
import { PAGE_TITLES } from '../../core/routing';

const routes: Routes = [
  {
    path: '',
    component: OnboardingLayout,
    providers: [OnboardingStore],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'welcome',
      },
      {
        path: 'welcome',
        title: PAGE_TITLES.WELCOME,
        loadComponent: () => import('./steps/welcome'),
      },
      {
        path: 'personal-info',
        title: PAGE_TITLES.PERSONAL_INFO,
        loadComponent: () => import('./steps/personal-info'),
      },
      {
        path: 'housing',
        title: PAGE_TITLES.HOUSING,
        loadComponent: () => import('./steps/housing'),
      },
      {
        path: 'income',
        title: PAGE_TITLES.INCOME,
        loadComponent: () => import('./steps/income'),
      },
      {
        path: 'health-insurance',
        title: PAGE_TITLES.HEALTH_INSURANCE,
        loadComponent: () => import('./steps/health-insurance'),
      },
      {
        path: 'phone-plan',
        title: PAGE_TITLES.PHONE_PLAN,
        loadComponent: () => import('./steps/phone-plan'),
      },
      {
        path: 'transport',
        title: PAGE_TITLES.TRANSPORT,
        loadComponent: () => import('./steps/transport'),
      },
      {
        path: 'leasing-credit',
        title: PAGE_TITLES.LEASING_CREDIT,
        loadComponent: () => import('./steps/leasing-credit'),
      },
      {
        path: 'registration',
        title: PAGE_TITLES.REGISTRATION,
        loadComponent: () => import('./steps/registration'),
      },
    ],
  },
];

export default routes;
