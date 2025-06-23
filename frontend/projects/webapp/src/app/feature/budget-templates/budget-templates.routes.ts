import { Routes } from '@angular/router';
import { BudgetTemplatesApi } from './services/budget-templates-api';
import { BudgetTemplatesState } from './services/budget-templates-state';

export const budgetTemplatesRoutes: Routes = [
  {
    path: '',
    providers: [BudgetTemplatesApi, BudgetTemplatesState],
    children: [
      {
        path: '',
        loadComponent: () => import('./budget-templates'),
      },
      {
        path: 'add',
        data: { breadcrumb: 'Ajouter un modèle', icon: 'add' },
        loadComponent: () => import('./add-template'),
      },
      {
        path: ':id',
        data: { breadcrumb: 'Détail du modèle', icon: 'visibility' },
        loadComponent: () => import('./details/template-detail'),
      },
    ],
  },
];

export default budgetTemplatesRoutes;
