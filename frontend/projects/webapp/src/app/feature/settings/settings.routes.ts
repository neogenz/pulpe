import { type Routes } from '@angular/router';
import { PAGE_TITLES } from '@core/routing';
import { SettingsDialogService } from './settings-dialog.service';

const routes: Routes = [
  {
    path: '',
    providers: [SettingsDialogService],
    title: PAGE_TITLES.SETTINGS,
    loadComponent: () => import('./settings-page'),
  },
];

export default routes;
