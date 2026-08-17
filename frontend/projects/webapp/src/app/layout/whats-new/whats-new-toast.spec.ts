import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { StorageService } from '@core/storage/storage.service';
import { STORAGE_KEYS } from '@core/storage/storage-keys';
import { WhatsNewToast } from './whats-new-toast';
import { CURRENT_APP_VERSION } from '@core/app-version/current-app-version';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { TranslocoService } from '@jsverse/transloco';
import { SUPPORTED_LOCALES, type SupportedLocale } from 'pulpe-shared';
import { LATEST_RELEASE } from './whats-new-releases';

describe('WhatsNewToast', () => {
  let fixture: ComponentFixture<WhatsNewToast>;
  let mockStorageService: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  let runningVersion: string;

  beforeEach(() => {
    runningVersion = LATEST_RELEASE.version;
  });

  function setup(
    dismissedVersion: string | null = null,
    locale: SupportedLocale = 'fr',
  ) {
    mockStorageService = {
      get: vi.fn().mockReturnValue(dismissedVersion),
      set: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [WhatsNewToast],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        { provide: StorageService, useValue: mockStorageService },
        { provide: CURRENT_APP_VERSION, useValue: runningVersion },
      ],
    });
    TestBed.inject(TranslocoService).setActiveLang(locale);

    fixture = TestBed.createComponent(WhatsNewToast);
    fixture.detectChanges();
  }

  function queryToast(): HTMLElement | null {
    return fixture.nativeElement.querySelector(
      '[data-testid="whats-new-toast"]',
    );
  }

  function queryDismissButton(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector(
      '[data-testid="whats-new-dismiss-button"]',
    );
  }

  describe('visibility', () => {
    it('should show toast when version matches and not dismissed', () => {
      setup(null);
      expect(queryToast()).toBeTruthy();
    });

    it('should hide toast when already dismissed for current version', () => {
      setup(LATEST_RELEASE.version);
      expect(queryToast()).toBeNull();
    });

    it('should show toast when dismissed version differs from current', () => {
      setup('0.0.0');
      expect(queryToast()).toBeTruthy();
    });

    it('should hide toast when build and release versions differ', () => {
      runningVersion = `${LATEST_RELEASE.version}-other`;
      setup(null);

      expect(queryToast()).toBeNull();
    });
  });

  describe('content', () => {
    it('should display the version number', () => {
      setup(null);
      const title = fixture.nativeElement.querySelector(
        '.text-title-small',
      ) as HTMLElement;

      expect(title.textContent).toContain(`v${LATEST_RELEASE.version}`);
    });

    it.each(SUPPORTED_LOCALES)(
      'should display the %s release copy and localized changelog link',
      (locale) => {
        setup(null, locale);
        const items = fixture.nativeElement.querySelectorAll('li');
        const features = LATEST_RELEASE.features[locale];
        const link = fixture.nativeElement.querySelector(
          '[data-testid="whats-new-changelog-link"]',
        ) as HTMLAnchorElement;

        expect(items.length).toBe(features.length);
        features.forEach((feature, i) => {
          expect(items[i].textContent).toContain(feature);
        });
        expect(link.getAttribute('href')).toBe(
          locale === 'fr'
            ? 'https://pulpe.app/changelog'
            : `https://pulpe.app/${locale}/changelog`,
        );
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      },
    );
  });

  describe('dismiss', () => {
    beforeEach(() => setup(null));

    it('should hide toast and persist version when dismissed', () => {
      queryDismissButton()!.click();
      fixture.detectChanges();

      expect(queryToast()).toBeNull();
      expect(mockStorageService.set).toHaveBeenCalledWith(
        STORAGE_KEYS.WHATS_NEW_DISMISSED,
        LATEST_RELEASE.version,
      );
    });
  });
});
