import { Routes } from '@angular/router';
import { BudgetCalculator } from './budget-calculator';

export const currentMonthRoutes: Routes = [
  {
    path: '',
    providers: [BudgetCalculator],
    children: [
      {
        path: '',
        loadComponent: () => import('./current-month'),
      },
    ],
  },
];

export default currentMonthRoutes;
