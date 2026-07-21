import { type Routes } from '@angular/router';
import { PAGE_TITLES, ROUTES } from '@core/routing';
import { SettingsDialogService } from './settings-dialog.service';

const routes: Routes = [
  {
    path: '',
    providers: [SettingsDialogService],
    children: [
      {
        path: '',
        title: PAGE_TITLES.SETTINGS,
        loadComponent: () => import('./settings-page'),
      },
      {
        path: ROUTES.SETTINGS_TAGS,
        title: PAGE_TITLES.SETTINGS_TAGS,
        data: { breadcrumb: 'settings.tags.title', icon: 'sell' },
        loadComponent: () => import('./tags-settings-page'),
      },
    ],
  },
];

export default routes;
