import { type Routes } from '@angular/router';
import { BudgetCalculator } from './services/budget-calculator';
import { CurrentMonthStore } from './services/current-month-store';
import { PAGE_TITLES } from '@core/routing';

export const currentMonthRoutes: Routes = [
  {
    path: '',
    providers: [BudgetCalculator, CurrentMonthStore],
    children: [
      {
        path: '',
        title: PAGE_TITLES.DASHBOARD_MONTH,
        loadComponent: () => import('./current-month'),
      },
    ],
  },
];

export default currentMonthRoutes;
