import { InjectionToken } from '@angular/core';

import { buildInfo } from '@env/build-info';

/**
 * Version of the currently running bundle. Indirected through DI so tests
 * can pin a version without depending on the generated build-info file.
 */
export const CURRENT_APP_VERSION = new InjectionToken<string>(
  'CURRENT_APP_VERSION',
  {
    providedIn: 'root',
    factory: () => buildInfo.version,
  },
);
