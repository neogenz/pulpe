import { type Routes } from '@angular/router';
import { PAGE_TITLES } from '@core/routing';
import { CurrentMonthStore } from './services/current-month-store';

export const currentMonthRoutes: Routes = [
  {
    path: '',
    providers: [CurrentMonthStore],
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
