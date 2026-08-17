import { inject, isDevMode, provideAppInitializer } from '@angular/core';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from 'pulpe-shared';
import { firstValueFrom } from 'rxjs';
import { StorageService } from '../storage/storage.service';
import { resolveStartupLanguage } from './language-resolver';
import { TranslocoHttpLoader } from './transloco-loader';

export function provideAppTransloco() {
  return [
    provideTransloco({
      config: {
        // Any language missing from this list is treated as a *scope* by
        // Transloco, which rewrites the loader URL to `${scope}/fr`. The
        // catalog would never be found and nothing would say so.
        availableLangs: [...SUPPORTED_LOCALES],
        defaultLang: DEFAULT_LOCALE,
        fallbackLang: DEFAULT_LOCALE,
        // `fallbackLang` alone only covers a catalog that fails to load; it
        // does nothing for a key missing from a catalog that loaded fine,
        // where the user would read the key path. The two go together.
        missingHandler: {
          useFallbackTranslation: true,
          logMissingKey: isDevMode(),
        },
        // Changing language reloads the page, so re-rendering on the fly buys
        // nothing — and would hold a `langChanges$` subscription per pipe
        // instance for the lifetime of every component that uses one.
        reRenderOnLangChange: false,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    provideAppInitializer(() => {
      const transloco = inject(TranslocoService);
      const language = resolveStartupLanguage(inject(StorageService));
      transloco.setActiveLang(language);
      // The document opens on `lang="en"`, which was wrong even when French
      // was the only language.
      document.documentElement.lang = language;
      // With `useFallbackTranslation`, this resolves both the active catalog
      // and the French one. That extra request is the price of per-key
      // fallback.
      return firstValueFrom(transloco.load(language));
    }),
  ];
}
