import { importProvidersFrom } from '@angular/core';
import { TranslocoTestingModule } from '@jsverse/transloco';

// eslint-disable-next-line boundaries/no-unknown -- JSON asset, not a layer import
import fr from '../../../public/i18n/fr.json';

export function provideTranslocoForTest() {
  return [
    importProvidersFrom(
      TranslocoTestingModule.forRoot({
        langs: { fr },
        translocoConfig: {
          availableLangs: ['fr'],
          defaultLang: 'fr',
        },
        preloadLangs: true,
      }),
    ),
  ];
}
