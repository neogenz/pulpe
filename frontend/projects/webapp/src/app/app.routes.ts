import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'home',
  },
  {
    path: 'home', // shorter import() because of use of "export default"
    loadChildren: () => import('./feature/home/home.routes'),
  },
  {
    path: '**', // fallback route (can be used to display dedicated 404 lazy feature)
    redirectTo: '',
  },
];
