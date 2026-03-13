import { type Routes } from '@angular/router';
import { PAGE_TITLES } from '@core/routing';
import { BudgetTemplatesApi } from './services/budget-templates-api';
import { BudgetTemplatesStore } from './services/budget-templates-store';
import { TransactionFormService } from './services/transaction-form';

export const budgetTemplatesRoutes: Routes = [
  {
    path: '',
    providers: [
      BudgetTemplatesApi,
      BudgetTemplatesStore,
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
        data: { breadcrumb: 'pageTitle.newTemplate', icon: 'add' },
        loadComponent: () => import('./create/create-template-page'),
      },
      {
        path: 'details/:templateId',
        title: PAGE_TITLES.TEMPLATE_DETAIL,
        data: { breadcrumb: 'pageTitle.templateDetail', icon: 'visibility' },
        loadComponent: () => import('./details/template-detail'),
      },
    ],
  },
];

export default budgetTemplatesRoutes;
