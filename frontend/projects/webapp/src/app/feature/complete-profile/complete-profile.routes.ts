import { type Routes } from '@angular/router';

export default [
  {
    path: '',
    loadComponent: () => import('./complete-profile-page'),
    data: {
      breadcrumb: 'pageTitle.completeProfile',
      icon: 'person_add',
    },
  },
] satisfies Routes;
