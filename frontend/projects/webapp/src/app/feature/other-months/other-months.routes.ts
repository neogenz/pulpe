import { Routes } from '@angular/router';
import { OtherMonthsApi } from './services/other-months-api';
import { PAGE_TITLES } from '@core/routing';

export const otherMonthsRoutes: Routes = [
  {
    path: '',
    providers: [OtherMonthsApi],
    children: [
      {
        path: '',
        title: PAGE_TITLES.BUDGET_HISTORY,
        loadComponent: () => import('./other-months'),
      },
    ],
  },
];

export default otherMonthsRoutes;
