import { Routes } from '@angular/router';
import { publicGuard } from '@core/auth';
import { authGuard } from '@core/auth/auth-guard';
import { MainLayout } from '@layout/main-layout';

export const ROUTES = {
  HOME: '',
  LOGIN: 'login',
  ONBOARDING: 'onboarding',
  APP: 'app',
  CURRENT_MONTH: '/app/current-month',
  OTHER_MONTHS: '/app/other-months',
  BUDGET_TEMPLATES: '/app/budget-templates',
  ONBOARDING_REGISTRATION: '/onboarding/registration',
  ONBOARDING_WELCOME: '/onboarding/welcome',
};

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'app',
  },
  {
    path: 'login',
    canActivate: [publicGuard],
    loadComponent: () => import('./feature/auth/login/login'),
  },
  {
    path: 'onboarding',
    canActivate: [publicGuard],
    loadChildren: () => import('./feature/onboarding/onboarding.routes'),
  },
  {
    path: 'app',
    canActivate: [authGuard],
    component: MainLayout,
    children: [
      {
        path: '',
        redirectTo: 'current-month',
        pathMatch: 'full',
      },
      {
        path: 'current-month',
        data: { breadcrumb: 'Mois en cours', icon: 'today' },
        loadChildren: () =>
          import('./feature/current-month/current-month.routes'),
      },
      {
        path: 'other-months',
        data: { breadcrumb: 'Autres mois', icon: 'date_range' },
        loadChildren: () =>
          import('./feature/other-months/other-months.routes'),
      },
      {
        path: 'budget-templates',
        data: { breadcrumb: 'Modèles de budget', icon: 'description' },
        loadChildren: () =>
          import('./feature/budget-templates/budget-templates.routes'),
      },
    ],
  },
  {
    path: '**', // fallback route (can be used to display dedicated 404 lazy feature)
    redirectTo: '',
  },
];
