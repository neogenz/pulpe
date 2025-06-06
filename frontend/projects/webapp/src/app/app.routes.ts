import { Routes } from '@angular/router';
import {
  OnboardingCompletedGuard,
  OnboardingRedirectGuard,
} from '@core/onboarding';
import { MainLayout } from '@layout/main-layout';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'app',
  },
  {
    path: 'auth',
    children: [
      {
        path: 'callback',
        loadComponent: () => import('./feature/auth/callback/callback'),
      },
      {
        path: 'magic-link-sent',
        loadComponent: () =>
          import('./feature/onboarding/magic-link-sent/magic-link-sent'),
      },
    ],
  },
  {
    path: 'login',
    loadComponent: () => import('./feature/auth/login/login'),
  },
  {
    path: 'onboarding',
    canActivate: [OnboardingRedirectGuard],
    loadChildren: () => import('./feature/onboarding/onboarding.routes'),
  },
  {
    path: 'app',
    canActivate: [OnboardingCompletedGuard],
    component: MainLayout,
    children: [
      {
        path: '',
        redirectTo: 'current-month',
        pathMatch: 'full',
      },
      {
        path: 'current-month',
        loadComponent: () => import('./feature/current-month/current-month'),
      },
      {
        path: 'other-months',
        loadComponent: () => import('./feature/other-months/other-months'),
      },
      {
        path: 'budget-templates',
        loadComponent: () =>
          import('./feature/budget-templates/budget-templates'),
      },
    ],
  },
  {
    path: '**', // fallback route (can be used to display dedicated 404 lazy feature)
    redirectTo: '',
  },
];
