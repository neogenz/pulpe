import { type Routes } from '@angular/router';
import { publicGuard, hasBudgetGuard } from '@core/auth';
import { authGuard } from '@core/auth/auth-guard';
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
    canActivate: [publicGuard],
    loadChildren: () => import('./feature/welcome'),
  },
  {
    path: ROUTES.LOGIN,
    title: PAGE_TITLES.LOGIN,
    canActivate: [publicGuard],
    loadComponent: () => import('./feature/auth/login/login'),
  },
  {
    path: ROUTES.SIGNUP,
    title: PAGE_TITLES.SIGNUP,
    canActivate: [publicGuard],
    loadComponent: () => import('./feature/auth/signup/signup'),
  },
  {
    path: ROUTES.LEGAL,
    title: PAGE_TITLES.LEGAL,
    loadChildren: () => import('./feature/legal/legal.routes'),
  },
  {
    path: ROUTES.APP,
    title: PAGE_TITLES.DASHBOARD,
    canActivate: [authGuard],
    loadComponent: () => import('@layout/main-layout'),
    children: [
      {
        path: '',
        redirectTo: ROUTES.CURRENT_MONTH,
        pathMatch: 'full',
      },
      {
        // Complete profile route - no hasBudgetGuard (would cause infinite loop)
        path: ROUTES.COMPLETE_PROFILE,
        title: PAGE_TITLES.COMPLETE_PROFILE,
        data: { breadcrumb: 'Finaliser mon profil', icon: 'person_add' },
        loadChildren: () =>
          import('./feature/complete-profile/complete-profile.routes'),
      },
      {
        path: ROUTES.CURRENT_MONTH,
        title: PAGE_TITLES.CURRENT_MONTH,
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
    ],
  },
  {
    path: '**', // fallback route (can be used to display dedicated 404 lazy feature)
    redirectTo: '',
  },
];
