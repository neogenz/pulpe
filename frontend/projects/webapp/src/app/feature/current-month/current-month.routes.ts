import { type Routes } from '@angular/router';
import { PAGE_TITLES } from '@core/routing';

export const currentMonthRoutes: Routes = [
  {
    path: '',
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
