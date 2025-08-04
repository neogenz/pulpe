import { Routes } from '@angular/router';
import { BudgetTemplatesApi } from './services/budget-templates-api';
import { BudgetTemplatesState } from './services/budget-templates-state';
import { TransactionFormService } from './services/transaction-form';
import { PAGE_TITLES } from '@core/routing';

export const budgetTemplatesRoutes: Routes = [
  {
    path: '',
    providers: [
      BudgetTemplatesApi,
      BudgetTemplatesState,
      TransactionFormService,
    ],
    children: [
      {
        path: '',
        title: PAGE_TITLES.BUDGET_TEMPLATES_LIST,
        loadComponent: () => import('./list/template-list-page'),
      },
      {
        path: 'create',
        title: PAGE_TITLES.NEW_TEMPLATE,
        data: { breadcrumb: 'Créer un modèle', icon: 'add' },
        loadComponent: () => import('./create/create-template-page'),
      },
      {
        path: 'details/:id',
        title: PAGE_TITLES.TEMPLATE_DETAIL,
        data: { breadcrumb: 'Détail du modèle', icon: 'visibility' },
        loadComponent: () => import('./details/template-detail-page'),
      },
    ],
  },
];

export default budgetTemplatesRoutes;
