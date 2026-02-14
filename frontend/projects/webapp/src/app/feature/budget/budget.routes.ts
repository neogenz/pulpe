import { type Routes } from '@angular/router';
import { PAGE_TITLES } from '@core/routing';
import { BudgetListStore } from './budget-list/budget-list-store';

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
        loadComponent: () => import('./budget-details/budget-details-page'),
      },
    ],
  },
];

export default budgetRoutes;
