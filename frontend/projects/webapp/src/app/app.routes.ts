import { Routes } from '@angular/router';
import {
  OnboardingCompletedGuard,
  OnboardingRedirectGuard,
} from '@core/onboarding';
import { MainLayout } from '@layout/main-layout';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'app',
  },
  {
    path: 'onboarding',
    canActivate: [OnboardingRedirectGuard],
    loadChildren: () => import('./feature/onboarding/onboarding.routes'),
  },
  {
    path: 'app',
    canActivate: [OnboardingCompletedGuard],
    component: MainLayout,
    children: [
      {
        path: '',
        loadChildren: () => import('./feature/home/home.routes'),
      },
    ],
  },
  {
    path: '**', // fallback route (can be used to display dedicated 404 lazy feature)
    redirectTo: '',
  },
];
