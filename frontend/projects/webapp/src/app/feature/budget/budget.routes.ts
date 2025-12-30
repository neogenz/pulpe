import { type ResolveFn, type Routes } from '@angular/router';
import { getBreadcrumbContext, PAGE_TITLES } from '@core/routing';
import { formatDate } from 'date-fns';
import { frCH } from 'date-fns/locale';
import { BudgetLineApi } from './budget-details/budget-line-api/budget-line-api';
import { BudgetTableDataProvider } from './budget-details/budget-table/budget-table-data-provider';
import { BudgetListStore } from './budget-list/budget-list-store';

const breadcrumbResolver: ResolveFn<string> = (route) => {
  const id = route.paramMap.get('id');
  if (!id) return 'Détail du budget';

  const context = getBreadcrumbContext(id);
  if (!context) return 'Détail du budget';

  const date = new Date(context.year, context.month - 1, 1);
  return formatDate(date, 'MMMM yyyy', { locale: frCH });
};

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
        resolve: { breadcrumb: breadcrumbResolver },
        data: { icon: 'visibility' },
        providers: [BudgetLineApi, BudgetTableDataProvider],
        loadComponent: () => import('./budget-details/budget-details-page'),
      },
    ],
  },
];

export default budgetRoutes;
