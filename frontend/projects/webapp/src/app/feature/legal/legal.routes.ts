import { type Routes } from '@angular/router';
import { ROUTES, PAGE_TITLES } from '@core/routing';

export const legalRoutes: Routes = [
  {
    path: ROUTES.LEGAL_TERMS,
    title: PAGE_TITLES.LEGAL_TERMS,
    loadComponent: () => import('./components/terms-of-service'),
  },
  {
    path: ROUTES.LEGAL_PRIVACY,
    title: PAGE_TITLES.LEGAL_PRIVACY,
    loadComponent: () => import('./components/privacy-policy'),
  },
  {
    path: '',
    redirectTo: ROUTES.LEGAL_TERMS,
    pathMatch: 'full',
  },
];
export default legalRoutes;
