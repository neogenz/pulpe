import { type Routes } from '@angular/router';
import { PAGE_TITLES } from '@core/routing';

const routes: Routes = [
  {
    path: '',
    title: PAGE_TITLES.DESIGN_SYSTEM,
    loadComponent: () => import('./design-system-page'),
  },
];

export default routes;
