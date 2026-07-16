import { type Routes } from '@angular/router';
import { PAGE_TITLES } from '@core/routing';
import { AddTransactionDialogService } from './services/add-transaction-dialog.service';
import { DashboardStore } from './services/dashboard-store';

export const currentMonthRoutes: Routes = [
  {
    path: '',
    providers: [AddTransactionDialogService, DashboardStore],
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
