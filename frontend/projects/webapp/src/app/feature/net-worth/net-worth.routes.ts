import { type Routes } from '@angular/router';
import { PAGE_TITLES } from '@core/routing';
import { NetWorthDialogService } from './services/net-worth-dialog.service';
import { NetWorthStore } from './services/net-worth-store';

export default [
  {
    path: '',
    providers: [NetWorthStore, NetWorthDialogService],
    children: [
      {
        path: '',
        title: PAGE_TITLES.NET_WORTH,
        loadComponent: () => import('./net-worth-page'),
      },
      {
        path: ':id',
        title: PAGE_TITLES.NET_WORTH_ASSET_DETAILS,
        data: {
          breadcrumb: 'pageTitle.netWorthAssetDetails',
          icon: 'account_balance_wallet',
        },
        loadComponent: () => import('./detail/asset-detail-page'),
      },
    ],
  },
] satisfies Routes;
