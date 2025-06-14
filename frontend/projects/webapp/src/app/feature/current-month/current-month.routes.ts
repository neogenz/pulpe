import { Routes } from '@angular/router';
import { BudgetCalculator } from './services/budget-calculator';
import { CurrentMonthState } from './services/current-month-state';

export const currentMonthRoutes: Routes = [
  {
    path: '',
    providers: [BudgetCalculator, CurrentMonthState],
    children: [
      {
        path: '',
        loadComponent: () => import('./current-month'),
      },
    ],
  },
];

export default currentMonthRoutes;
