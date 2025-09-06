import { type Routes } from '@angular/router';
import { BudgetLineApi } from './details/budget-line-api/budget-line-api';
import { BudgetTableDataProvider } from './details/budget-table/budget-table-data-provider';
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
        providers: [BudgetLineApi, BudgetTableDataProvider],
        loadComponent: () => import('./details/details-page'),
      },
    ],
  },
];

export default budgetRoutes;
