import { Routes } from '@angular/router';
import { OtherMonthsApi } from './other-months-api';

export const otherMonthsRoutes: Routes = [
  {
    path: '',
    providers: [OtherMonthsApi],
    children: [
      {
        path: '',
        loadComponent: () => import('./other-months'),
      },
    ],
  },
];

export default otherMonthsRoutes;
