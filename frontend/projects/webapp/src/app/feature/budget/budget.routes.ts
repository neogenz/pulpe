import { type Routes } from '@angular/router';
import { BudgetLineApi } from './budget-details/budget-line-api/budget-line-api';
import { BudgetTableDataProvider } from './budget-details/budget-table/budget-table-data-provider';
import { BudgetListStore } from './budget-list/budget-list-store';
import { PAGE_TITLES } from '@core/routing';

export const budgetRoutes: Routes = [
  {
    path: '',
    providers: [BudgetListStore],
    children: [
      {
        path: '',
        title: PAGE_TITLES.BUDGET,
        loadComponent: () => import('./budget-list/budget-list-page'),
      },
      {
        path: ':id',
        title: PAGE_TITLES.BUDGET_DETAILS,
        data: { breadcrumb: 'Détail du budget', icon: 'visibility' },
        providers: [BudgetLineApi, BudgetTableDataProvider],
        loadComponent: () => import('./budget-details/budget-details-page'),
      },
    ],
  },
];

export default budgetRoutes;
