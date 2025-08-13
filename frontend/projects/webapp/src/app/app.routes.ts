import { Routes } from '@angular/router';
import { publicGuard } from '@core/auth';
import { authGuard } from '@core/auth/auth-guard';
import { MainLayout } from '@layout/main-layout';
import { PAGE_TITLES, ROUTES } from '@core/routing';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: ROUTES.APP,
  },
  {
    path: ROUTES.LOGIN,
    title: PAGE_TITLES.LOGIN,
    canActivate: [publicGuard],
    loadComponent: () => import('./feature/auth/login/login'),
  },
  {
    path: ROUTES.ONBOARDING,
    title: PAGE_TITLES.ONBOARDING,
    canActivate: [publicGuard],
    loadChildren: () => import('./feature/onboarding/onboarding.routes'),
  },
  {
    path: ROUTES.APP,
    title: PAGE_TITLES.DASHBOARD,
    canActivate: [authGuard],
    component: MainLayout,
    children: [
      {
        path: '',
        redirectTo: ROUTES.CURRENT_MONTH,
        pathMatch: 'full',
      },
      {
        path: ROUTES.CURRENT_MONTH,
        title: PAGE_TITLES.CURRENT_MONTH,
        data: { breadcrumb: 'Mois en cours', icon: 'today' },
        loadChildren: () =>
          import('./feature/current-month/current-month.routes'),
      },
      {
        path: ROUTES.BUDGET,
        title: PAGE_TITLES.BUDGET,
        data: { breadcrumb: 'Mes budgets', icon: 'calendar_month' },
        loadChildren: () => import('./feature/budget/budget.routes'),
      },
      {
        path: ROUTES.BUDGET_TEMPLATES,
        title: PAGE_TITLES.BUDGET_TEMPLATES,
        data: { breadcrumb: 'Modèles de budget', icon: 'description' },
        loadChildren: () =>
          import('./feature/budget-templates/budget-templates.routes'),
      },
      {
        path: ROUTES.SETTINGS,
        title: PAGE_TITLES.SETTINGS,
        data: { breadcrumb: 'Paramètres', icon: 'settings' },
        loadChildren: () =>
          import('./feature/settings/settings.routes').then(
            (m) => m.settingsRoutes,
          ),
      },
    ],
  },
  {
    path: '**', // fallback route (can be used to display dedicated 404 lazy feature)
    redirectTo: '',
  },
];
