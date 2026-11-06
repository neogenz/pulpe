import { type Routes } from '@angular/router';
import { PAGE_TITLES } from '@core/routing';
import { NetWorthDialogService } from './services/net-worth-dialog.service';
import { NetWorthStore } from './services/net-worth-store';

export default [
  {
    path: '',
    providers: [NetWorthStore, NetWorthDialogService],
    title: PAGE_TITLES.NET_WORTH,
    loadComponent: () => import('./net-worth-page'),
  },
] satisfies Routes;
