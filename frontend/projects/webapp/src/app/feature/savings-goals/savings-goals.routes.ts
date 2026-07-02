import { type Routes } from '@angular/router';
import { PAGE_TITLES } from '@core/routing';
import { SavingsGoalStore } from './services/savings-goals-store';

export const savingsGoalsRoutes: Routes = [
  {
    path: '',
    providers: [SavingsGoalStore],
    children: [
      {
        path: '',
        title: PAGE_TITLES.SAVINGS_GOALS,
        loadComponent: () => import('./list/savings-goals-list-page'),
      },
      {
        path: ':id',
        title: PAGE_TITLES.SAVINGS_GOAL_DETAILS,
        data: { breadcrumb: 'pageTitle.savingsGoalDetails', icon: 'savings' },
        loadComponent: () => import('./detail/savings-goal-detail-page'),
      },
    ],
  },
];

export default savingsGoalsRoutes;
