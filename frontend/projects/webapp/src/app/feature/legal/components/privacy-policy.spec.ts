import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import PrivacyPolicyComponent from './privacy-policy';

/* eslint-disable boundaries/no-unknown -- JSON assets, not layer imports */
import en from '../../../../../public/i18n/en.json';
import de from '../../../../../public/i18n/de.json';
import italian from '../../../../../public/i18n/it.json';
/* eslint-enable boundaries/no-unknown */

const cases = [
  [
    'fr',
    '1 septembre 2026',
    '9. Tes droits (RGPD/LPD)',
    'le replay est désactivé en production',
    'sans stockage permanent',
    'langue, devise',
    'peut être consulté publiquement sur GitHub',
    [
      'Notes et commentaire facultatif',
      'Analyser tes avis',
      'Avis envoyés : conservés avec ton compte',
      'avis envoyés compris',
    ],
  ],
  [
    'en',
    'September 1, 2026',
    '9. Your rights (GDPR/FADP)',
    'replay is disabled in production',
    'does not store it permanently',
    'language, currency',
    'can be viewed publicly on GitHub',
    [
      'Ratings and optional comment',
      'Analyse your feedback',
      'Submitted feedback: retained with your account',
      'including submitted feedback',
    ],
  ],
  [
    'de',
    '1. September 2026',
    '9. Deine Rechte (DSGVO/DSG)',
    'Wiedergabe ist in der Produktion deaktiviert',
    'speichert sie nicht dauerhaft',
    'Sprache, Währung',
    'kann öffentlich auf GitHub eingesehen werden',
    [
      'Bewertungen und optionaler Kommentar',
      'Dein Feedback auszuwerten',
      'Gesendetes Feedback: wird zusammen mit deinem Konto aufbewahrt',
      'einschliesslich deines Feedbacks',
    ],
  ],
  [
    'it',
    '1 settembre 2026',
    '9. I tuoi diritti (GDPR/LPD)',
    'replay è disattivato in produzione',
    'senza archiviarli in modo permanente',
    'lingua, valuta',
    'può essere consultato pubblicamente su GitHub',
    [
      'Valutazioni e commento facoltativo',
      'Analizzare il tuo feedback',
      'Feedback inviato: conservato insieme al tuo account',
      'feedback inviato incluso',
    ],
  ],
] as const;

const providers = [
  'Supabase',
  'Railway',
  'Vercel',
  'PostHog',
  'Cloudflare Turnstile',
  'Google',
];

const technicalInvariants = [
  'eu.posthog.com',
  'USA - Oregon',
  'CDN',
  'OAuth',
  'HTTPS',
  'JWT',
  'Row Level Security',
  'PostHog Inc.',
  'Data Processing Agreement',
  'JSON',
];

describe('PrivacyPolicyComponent', () => {
  it.each(cases)(
    'renders the complete %s document without changing legal invariants',
    async (
      lang,
      date,
      rightsTitle,
      replayDisabled,
      railwayNoStorage,
      localePreference,
      publicSourceStatement,
      feedbackStatements,
    ) => {
      TestBed.configureTestingModule({
        imports: [PrivacyPolicyComponent],
        providers: [
          provideZonelessChangeDetection(),
          provideRouter([]),
          ...provideTranslocoForTest({ en, de, it: italian }),
        ],
      });
      TestBed.inject(TranslocoService).setActiveLang(lang);

      const fixture = TestBed.createComponent(PrivacyPolicyComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      const element: HTMLElement = fixture.nativeElement;
      const text = element.textContent ?? '';
      const links = [...element.querySelectorAll<HTMLAnchorElement>('a')].map(
        (link) => link.getAttribute('href'),
      );

      expect(element.querySelectorAll('section')).toHaveLength(13);
      expect(text).toContain(date);
      expect(text).toContain(rightsTitle);
      expect(text).toContain(replayDisabled);
      expect(text).toContain(railwayNoStorage);
      expect(text).toContain(localePreference);
      expect(text).toContain(publicSourceStatement);
      for (const statement of feedbackStatements)
        expect(text).toContain(statement);
      expect(text.toLowerCase()).not.toContain('open source');
      expect(text).toContain('12');
      expect(text).toContain('3');
      expect(text).toContain('24');
      expect(text).toContain('21');
      expect(text).toContain('6');
      expect(text).toContain('28');
      expect(text).toMatch(/(?:UUID Supabase|Supabase UUID)/);
      expect(text).toMatch(/Euro(?:pe|pa) - Frankfurt/);
      for (const provider of providers) expect(text).toContain(provider);
      for (const invariant of technicalInvariants)
        expect(text).toContain(invariant);
      expect(text).not.toContain('legal.privacy');
      expect(links).toContain('mailto:maxime.desogus@gmail.com');
      expect(links).toContain('https://github.com/neogenz/pulpe');
      expect(links).toContain('/legal/cgu');
    },
  );
});
