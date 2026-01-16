import { type Routes } from '@angular/router';
import { PAGE_TITLES } from '@core/routing';

export const maintenanceRoutes: Routes = [
  {
    path: '',
    title: PAGE_TITLES.MAINTENANCE,
    loadComponent: () => import('./maintenance-page'),
  },
];
export default maintenanceRoutes;
