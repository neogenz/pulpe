import { type Routes } from '@angular/router';

export default [
  {
    path: '',
    loadComponent: () => import('./complete-profile-page'),
    data: {
      breadcrumb: 'Finaliser mon profil',
      icon: 'person_add',
    },
  },
] satisfies Routes;
