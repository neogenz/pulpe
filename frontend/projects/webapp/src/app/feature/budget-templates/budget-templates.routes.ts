import { Routes } from '@angular/router';
import { BudgetTemplatesApi } from './services/budget-templates-api';
import { BudgetTemplatesState } from './services/budget-templates-state';
import { PAGE_TITLES } from '@core/routing';

export const budgetTemplatesRoutes: Routes = [
  {
    path: '',
    providers: [BudgetTemplatesApi, BudgetTemplatesState],
    children: [
      {
        path: '',
        title: PAGE_TITLES.BUDGET_TEMPLATES_LIST,
        loadComponent: () => import('./budget-templates'),
      },
      {
        path: 'add',
        title: PAGE_TITLES.NEW_TEMPLATE,
        data: { breadcrumb: 'Ajouter un modèle', icon: 'add' },
        loadComponent: () => import('./add-template'),
      },
      {
        path: ':templateId',
        title: PAGE_TITLES.TEMPLATE_DETAIL,
        data: { breadcrumb: 'Détail du modèle', icon: 'visibility' },
        loadComponent: () => import('./details/template-detail'),
      },
    ],
  },
];

export default budgetTemplatesRoutes;
