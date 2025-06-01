import { Routes } from '@angular/router';
import {
  OnboardingCompletedGuard,
  OnboardingRedirectGuard,
} from './core/onboarding';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'app',
  },
  {
    path: 'app',
    canActivate: [OnboardingCompletedGuard],
    loadComponent: () =>
      import('./layout/main-layout').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: '',
        loadChildren: () => import('./feature/home/home.routes'),
      },
    ],
  },
  {
    path: 'onboarding',
    canActivate: [OnboardingRedirectGuard],
    loadChildren: () => import('./feature/onboarding/onboarding.routes'),
  },
  {
    path: '**', // fallback route (can be used to display dedicated 404 lazy feature)
    redirectTo: '',
  },
];
