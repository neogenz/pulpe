import { Routes } from '@angular/router';
import { BudgetApi } from './budget-api';
import { PAGE_TITLES } from '@core/routing';

export const budgetRoutes: Routes = [
  {
    path: '',
    providers: [BudgetApi],
    children: [
      {
        path: '',
        title: PAGE_TITLES.BUDGET,
        loadComponent: () => import('./budget-list-page'),
      },
      {
        path: ':id',
        title: PAGE_TITLES.BUDGET_DETAILS,
        data: { breadcrumb: 'Détail du budget', icon: 'visibility' },
        loadComponent: () => import('./details/details-page'),
      },
    ],
  },
];

export default budgetRoutes;
