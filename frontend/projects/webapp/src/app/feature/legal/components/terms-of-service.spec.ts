import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import TermsOfServiceComponent from './terms-of-service';

/* eslint-disable boundaries/no-unknown -- JSON assets, not layer imports */
import en from '../../../../../public/i18n/en.json';
import de from '../../../../../public/i18n/de.json';
import italian from '../../../../../public/i18n/it.json';
/* eslint-enable boundaries/no-unknown */

const cases = [
  [
    'fr',
    '27 janvier 2026',
    '10. Droit applicable',
    '5. Connexions à des assistants IA',
  ],
  [
    'en',
    'January 27, 2026',
    '10. Governing law',
    '5. Connections to AI assistants',
  ],
  [
    'de',
    '27. Januar 2026',
    '10. Anwendbares Recht',
    '5. Verbindungen zu KI-Assistenten',
  ],
  [
    'it',
    '27 gennaio 2026',
    '10. Legge applicabile',
    '5. Connessioni ad assistenti IA',
  ],
] as const;

describe('TermsOfServiceComponent', () => {
  it.each(cases)(
    'renders the complete %s document',
    async (lang, date, law, assistants) => {
      TestBed.configureTestingModule({
        imports: [TermsOfServiceComponent],
        providers: [
          provideZonelessChangeDetection(),
          provideRouter([]),
          ...provideTranslocoForTest({ en, de, it: italian }),
        ],
      });
      TestBed.inject(TranslocoService).setActiveLang(lang);

      const fixture = TestBed.createComponent(TermsOfServiceComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      const element: HTMLElement = fixture.nativeElement;
      const text = element.textContent ?? '';
      const links = [...element.querySelectorAll<HTMLAnchorElement>('a')].map(
        (link) => link.getAttribute('href'),
      );

      expect(element.querySelectorAll('section')).toHaveLength(11);
      expect(text).toContain(date);
      expect(text).toContain(law);
      expect(text).toContain(assistants);
      expect(text).not.toContain('legal.terms');
      expect(links).toContain('mailto:maxime.desogus@gmail.com');
      expect(links).toContain('/legal/confidentialite');
    },
  );
});
