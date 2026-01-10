import { type Routes } from '@angular/router';
import { PAGE_TITLES } from '@core/routing';

export const welcomeRoutes: Routes = [
  {
    path: '',
    title: PAGE_TITLES.WELCOME,
    loadComponent: () => import('./welcome-page'),
  },
];
export default welcomeRoutes;
