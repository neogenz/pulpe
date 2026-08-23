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
      {
        path: ROUTES.SETTINGS_CONNECTIONS,
        title: PAGE_TITLES.SETTINGS_CONNECTIONS,
        data: { breadcrumb: 'settings.connections.title', icon: 'smart_toy' },
        loadComponent: () => import('./connections/connections'),
      },
    ],
  },
];

export default routes;
