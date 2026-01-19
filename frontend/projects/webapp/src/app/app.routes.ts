import { type Routes } from '@angular/router';
import { publicGuard, hasBudgetGuard } from '@core/auth';
import { authGuard } from '@core/auth/auth-guard';
import { maintenanceGuard } from '@core/maintenance';
import { PAGE_TITLES, ROUTES } from '@core/routing';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: ROUTES.WELCOME,
  },
  {
    path: ROUTES.WELCOME,
    title: PAGE_TITLES.WELCOME,
    canActivate: [maintenanceGuard, publicGuard],
    loadChildren: () => import('./feature/welcome'),
  },
  {
    path: ROUTES.LOGIN,
    title: PAGE_TITLES.LOGIN,
    canActivate: [maintenanceGuard, publicGuard],
    loadComponent: () => import('./feature/auth/login/login'),
  },
  {
    path: ROUTES.SIGNUP,
    title: PAGE_TITLES.SIGNUP,
    canActivate: [maintenanceGuard, publicGuard],
    loadComponent: () => import('./feature/auth/signup/signup'),
  },
  {
    path: ROUTES.MAINTENANCE,
    title: PAGE_TITLES.MAINTENANCE,
    loadChildren: () => import('./feature/maintenance/maintenance.routes'),
  },
  {
    path: ROUTES.LEGAL,
    title: PAGE_TITLES.LEGAL,
    canActivate: [maintenanceGuard],
    loadChildren: () => import('./feature/legal/legal.routes'),
  },
  {
    path: '',
    title: PAGE_TITLES.DASHBOARD,
    canActivate: [maintenanceGuard, authGuard],
    loadComponent: () => import('@layout/main-layout'),
    children: [
      {
        path: '',
        redirectTo: ROUTES.DASHBOARD,
        pathMatch: 'full',
      },
      {
        path: ROUTES.COMPLETE_PROFILE,
        title: PAGE_TITLES.COMPLETE_PROFILE,
        data: { breadcrumb: 'Finaliser mon profil', icon: 'person_add' },
        loadChildren: () =>
          import('./feature/complete-profile/complete-profile.routes'),
      },
      {
        path: ROUTES.DASHBOARD,
        title: PAGE_TITLES.DASHBOARD,
        canActivate: [hasBudgetGuard],
        data: { breadcrumb: 'Mois en cours', icon: 'today' },
        loadChildren: () =>
          import('./feature/current-month/current-month.routes'),
      },
      {
        path: ROUTES.BUDGET,
        title: PAGE_TITLES.BUDGET,
        canActivate: [hasBudgetGuard],
        data: { breadcrumb: 'Mes budgets', icon: 'calendar_month' },
        loadChildren: () => import('./feature/budget/budget.routes'),
      },
      {
        path: ROUTES.BUDGET_TEMPLATES,
        title: PAGE_TITLES.BUDGET_TEMPLATES,
        canActivate: [hasBudgetGuard],
        data: { breadcrumb: 'Modèles de budget', icon: 'description' },
        loadChildren: () =>
          import('./feature/budget-templates/budget-templates.routes'),
      },
      {
        path: ROUTES.SETTINGS,
        title: PAGE_TITLES.SETTINGS,
        data: { breadcrumb: 'Paramètres', icon: 'settings' },
        loadChildren: () => import('./feature/settings/settings.routes'),
      },
    ],
  },
  {
    path: '**',
    redirectTo: ROUTES.WELCOME,
  },
];
