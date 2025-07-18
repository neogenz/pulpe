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
    ],
  },
];

export default budgetRoutes;
