import { type Routes } from '@angular/router';
import { BudgetLineApi } from './details/services/budget-line-api';
import { BudgetTableMapper } from './details/services/budget-table-mapper';
import { PAGE_TITLES } from '@core/routing';

export const budgetRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: '',
        title: PAGE_TITLES.BUDGET,
        loadComponent: () => import('./list/budget-list-page'),
      },
      {
        path: ':id',
        title: PAGE_TITLES.BUDGET_DETAILS,
        data: { breadcrumb: 'Détail du budget', icon: 'visibility' },
        providers: [BudgetLineApi, BudgetTableMapper],
        loadComponent: () => import('./details/details-page'),
      },
    ],
  },
];

export default budgetRoutes;
