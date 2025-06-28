import { Routes } from '@angular/router';
import { publicGuard } from '@core/auth';
import { authGuard } from '@core/auth/auth-guard';
import { MainLayout } from '@layout/main-layout';
import { PAGE_TITLES } from '@core/routing';

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
    title: PAGE_TITLES.LOGIN,
    canActivate: [publicGuard],
    loadComponent: () => import('./feature/auth/login/login'),
  },
  {
    path: 'onboarding',
    title: PAGE_TITLES.ONBOARDING,
    canActivate: [publicGuard],
    loadChildren: () => import('./feature/onboarding/onboarding.routes'),
  },
  {
    path: 'app',
    title: PAGE_TITLES.DASHBOARD,
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
        title: PAGE_TITLES.CURRENT_MONTH,
        data: { breadcrumb: 'Mois en cours', icon: 'today' },
        loadChildren: () =>
          import('./feature/current-month/current-month.routes'),
      },
      {
        path: 'other-months',
        title: PAGE_TITLES.OTHER_MONTHS,
        data: { breadcrumb: 'Autres mois', icon: 'date_range' },
        loadChildren: () =>
          import('./feature/other-months/other-months.routes'),
      },
      {
        path: 'budget-templates',
        title: PAGE_TITLES.BUDGET_TEMPLATES,
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
