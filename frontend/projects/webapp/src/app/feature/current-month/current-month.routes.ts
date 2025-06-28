import { Routes } from '@angular/router';
import { BudgetCalculator } from './services/budget-calculator';
import { CurrentMonthState } from './services/current-month-state';
import { PAGE_TITLES } from '@core/routing';

export const currentMonthRoutes: Routes = [
  {
    path: '',
    providers: [BudgetCalculator, CurrentMonthState],
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
