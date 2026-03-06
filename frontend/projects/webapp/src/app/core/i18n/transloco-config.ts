import { isDevMode } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { TranslocoHttpLoader } from './transloco-loader';

export function provideAppTransloco() {
  return provideTransloco({
    config: {
      availableLangs: ['fr'],
      defaultLang: 'fr',
      reRenderOnLangChange: false,
      prodMode: !isDevMode(),
    },
    loader: TranslocoHttpLoader,
  });
}
