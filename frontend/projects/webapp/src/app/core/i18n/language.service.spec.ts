import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ANALYTICS_EVENTS } from 'pulpe-shared';
import { AnalyticsService } from '../analytics/analytics';
import { AuthStore } from '../auth/auth-store';
import { Logger } from '../logging/logger';
import { PAGE_RELOAD } from '../page-reload';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { StorageService } from '../storage/storage.service';
import { UserSettingsStore } from '../user-settings/user-settings-store';
import { LanguageService } from './language.service';

describe('LanguageService', () => {
  const locale = signal<'fr' | 'de' | 'en' | 'it'>('fr');
  const isAuthenticated = signal(false);
  const analytics = { captureEvent: vi.fn(), setLocale: vi.fn() };
  const logger = { error: vi.fn() };
  const reload = vi.fn();
  const storage = { setString: vi.fn() };
  const userSettings = {
    locale: locale.asReadonly(),
    updateSettings: vi.fn(),
  };
  let service: LanguageService;

  beforeEach(() => {
    vi.clearAllMocks();
    locale.set('fr');
    isAuthenticated.set(false);
    userSettings.updateSettings.mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        LanguageService,
        { provide: AnalyticsService, useValue: analytics },
        { provide: AuthStore, useValue: { isAuthenticated } },
        { provide: Logger, useValue: logger },
        { provide: PAGE_RELOAD, useValue: reload },
        { provide: StorageService, useValue: storage },
        { provide: UserSettingsStore, useValue: userSettings },
      ],
    });

    service = TestBed.inject(LanguageService);
  });

  it('does nothing when the locale is unchanged', async () => {
    await service.change('fr', 'settings');

    expect(storage.setString).not.toHaveBeenCalled();
    expect(analytics.captureEvent).not.toHaveBeenCalled();
    expect(userSettings.updateSettings).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('stores and tracks an anonymous language change before reloading', async () => {
    await service.change('de', 'welcome');

    expect(storage.setString).toHaveBeenCalledWith(
      STORAGE_KEYS.SETTINGS_LANGUAGE,
      'de',
    );
    expect(analytics.captureEvent).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.LANGUAGE_CHANGED,
      { from: 'fr', to: 'de', surface: 'welcome' },
      { send_instantly: true },
    );
    expect(analytics.setLocale).toHaveBeenCalledWith('de');
    expect(userSettings.updateSettings).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('persists an authenticated language change before reloading', async () => {
    isAuthenticated.set(true);
    let resolveUpdate!: () => void;
    userSettings.updateSettings.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveUpdate = resolve;
      }),
    );

    const change = service.change('en', 'settings');

    expect(userSettings.updateSettings).toHaveBeenCalledWith({ locale: 'en' });
    expect(reload).not.toHaveBeenCalled();

    resolveUpdate();
    await change;

    expect(reload).toHaveBeenCalledOnce();
  });

  it('logs a persistence failure and still reloads from the local snapshot', async () => {
    isAuthenticated.set(true);
    const error = new Error('offline');
    userSettings.updateSettings.mockRejectedValue(error);

    await service.change('it', 'settings');

    expect(storage.setString).toHaveBeenCalledWith(
      STORAGE_KEYS.SETTINGS_LANGUAGE,
      'it',
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to persist the language preference',
      error,
    );
    expect(reload).toHaveBeenCalledOnce();
  });
});
