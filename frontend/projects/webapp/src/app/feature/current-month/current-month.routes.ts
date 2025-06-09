import { Routes } from '@angular/router';

export const currentMonthRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./current-month'),
  },
];

export default currentMonthRoutes;
