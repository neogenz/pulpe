import { type Routes } from '@angular/router';
import { PAGE_TITLES } from '@core/routing';

const routes: Routes = [
  {
    path: '',
    title: PAGE_TITLES.SETTINGS,
    loadComponent: () => import('./settings-page'),
  },
];

export default routes;
