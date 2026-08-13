import { importProvidersFrom } from '@angular/core';
import { TranslocoTestingModule } from '@jsverse/transloco';
import type { SupportedLocale } from 'pulpe-shared';

// eslint-disable-next-line boundaries/no-unknown -- JSON asset, not a layer import
import fr from '../../../public/i18n/fr.json';

type Catalog = Record<string, unknown>;

/**
 * French only by default — the 104 specs that assert French copy keep working
 * untouched. `TranslocoTestingModule.forRoot` builds its own config and never
 * reads the application one, so widening `availableLangs` in the app changes
 * nothing here.
 *
 * A spec that needs another language passes its catalog:
 * `provideTranslocoForTest({ de })`. Passing a language *without* its catalog
 * would be worse than useless: `TestingLoader.getTranslation` is literally
 * `of(this.langs[lang])`, so the missing entry yields an empty catalog with no
 * error and no warning — `logMissingKey` is forced off in tests.
 */
export function provideTranslocoForTest(
  extraLangs: Partial<Record<Exclude<SupportedLocale, 'fr'>, Catalog>> = {},
) {
  const langs = { fr, ...extraLangs };

  return [
    importProvidersFrom(
      TranslocoTestingModule.forRoot({
        langs,
        translocoConfig: {
          availableLangs: Object.keys(langs),
          defaultLang: 'fr',
        },
        preloadLangs: true,
      }),
    ),
  ];
}
