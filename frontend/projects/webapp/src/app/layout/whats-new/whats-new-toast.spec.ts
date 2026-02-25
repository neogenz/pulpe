import { describe, expect, it, vi, beforeEach } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { StorageService } from '@core/storage/storage.service';
import { STORAGE_KEYS } from '@core/storage/storage-keys';
import { WhatsNewToast } from './whats-new-toast';
import { LATEST_RELEASE } from './whats-new-releases';

vi.mock('@env/build-info', () => ({
  buildInfo: { version: '0.24.0' },
}));

describe('WhatsNewToast', () => {
  let fixture: ComponentFixture<WhatsNewToast>;
  let mockStorageService: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  function setup(dismissedVersion: string | null = null) {
    mockStorageService = {
      get: vi.fn().mockReturnValue(dismissedVersion),
      set: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [WhatsNewToast],
      providers: [
        provideZonelessChangeDetection(),
        { provide: StorageService, useValue: mockStorageService },
      ],
    });

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
      setup('0.24.0');
      expect(queryToast()).toBeNull();
    });

    it('should show toast when dismissed version differs from current', () => {
      setup('0.23.0');
      expect(queryToast()).toBeTruthy();
    });
  });

  describe('content', () => {
    beforeEach(() => setup(null));

    it('should display the version number', () => {
      const title = fixture.nativeElement.querySelector(
        '.text-title-small',
      ) as HTMLElement;

      expect(title.textContent).toContain('v0.24.0');
    });

    it('should display all release features', () => {
      const items = fixture.nativeElement.querySelectorAll('li');

      expect(items.length).toBe(LATEST_RELEASE.features.length);
      LATEST_RELEASE.features.forEach((feature, i) => {
        expect(items[i].textContent).toContain(feature);
      });
    });

    it('should have a changelog link opening in new tab', () => {
      const link = fixture.nativeElement.querySelector(
        '[data-testid="whats-new-changelog-link"]',
      ) as HTMLAnchorElement;

      expect(link).toBeTruthy();
      expect(link.getAttribute('href')).toBe('/changelog');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener');
    });
  });

  describe('dismiss', () => {
    beforeEach(() => setup(null));

    it('should hide toast and persist version when dismissed', () => {
      queryDismissButton()!.click();
      fixture.detectChanges();

      expect(queryToast()).toBeNull();
      expect(mockStorageService.set).toHaveBeenCalledWith(
        STORAGE_KEYS.WHATS_NEW_DISMISSED,
        '0.24.0',
      );
    });
  });
});
