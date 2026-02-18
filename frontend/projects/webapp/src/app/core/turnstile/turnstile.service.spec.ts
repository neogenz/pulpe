import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TurnstileService } from './turnstile.service';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { Logger } from '@core/logging/logger';

describe('TurnstileService', () => {
  let service: TurnstileService;
  let mockConfig: {
    turnstile: ReturnType<typeof vi.fn>;
    isLocal: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();

    mockConfig = {
      turnstile: vi.fn().mockReturnValue({ siteKey: 'test-site-key' }),
      isLocal: vi.fn().mockReturnValue(false),
    };

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        TurnstileService,
        { provide: ApplicationConfiguration, useValue: mockConfig },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(TurnstileService);
  });

  afterEach(() => {
    vi.useRealTimers();
    service.reset();
  });

  describe('initial state', () => {
    it('should not be processing initially', () => {
      expect(service.isProcessing()).toBe(false);
    });

    it('should not render initially', () => {
      expect(service.shouldRender()).toBe(false);
    });

    it('should provide site key from config', () => {
      expect(service.siteKey()).toBe('test-site-key');
    });

    it('should use turnstile when not local', () => {
      expect(service.shouldUseTurnstile()).toBe(true);
    });

    it('should not use turnstile when local', () => {
      mockConfig.isLocal.mockReturnValue(true);

      expect(service.shouldUseTurnstile()).toBe(false);
    });
  });

  describe('startVerification', () => {
    it('should set processing to true', () => {
      const onToken = vi.fn();
      const onError = vi.fn();

      service.startVerification(undefined, onToken, onError);

      expect(service.isProcessing()).toBe(true);
    });

    it('should skip turnstile and call onToken in local environment', () => {
      mockConfig.isLocal.mockReturnValue(true);
      const onToken = vi.fn();
      const onError = vi.fn();

      service.startVerification(undefined, onToken, onError);

      expect(onToken).toHaveBeenCalledWith('');
      expect(service.isProcessing()).toBe(false);
    });

    it('should render turnstile widget when no widget exists', () => {
      const onToken = vi.fn();
      const onError = vi.fn();

      service.startVerification(undefined, onToken, onError);

      expect(service.shouldRender()).toBe(true);
    });

    it('should reset existing widget instead of rendering new one', () => {
      const mockWidget = { reset: vi.fn() };
      const onToken = vi.fn();
      const onError = vi.fn();

      service.startVerification(mockWidget as never, onToken, onError);

      expect(mockWidget.reset).toHaveBeenCalled();
      expect(service.shouldRender()).toBe(false);
    });
  });

  describe('handleResolved', () => {
    it('should call onToken callback with valid token', () => {
      const onToken = vi.fn();
      const onError = vi.fn();

      service.startVerification(undefined, onToken, onError);
      service.handleResolved('valid-token');

      expect(onToken).toHaveBeenCalledWith('valid-token');
      expect(service.isProcessing()).toBe(false);
    });

    it('should call onError callback when token is null', () => {
      const onToken = vi.fn();
      const onError = vi.fn();

      service.startVerification(undefined, onToken, onError);
      service.handleResolved(null);

      expect(onError).toHaveBeenCalledWith(
        'La vérification de sécurité a échoué — réessaie',
      );
      expect(onToken).not.toHaveBeenCalled();
    });

    it('should ignore duplicate resolutions', () => {
      const onToken = vi.fn();
      const onError = vi.fn();

      service.startVerification(undefined, onToken, onError);
      service.handleResolved('first-token');
      service.handleResolved('second-token');

      expect(onToken).toHaveBeenCalledTimes(1);
      expect(onToken).toHaveBeenCalledWith('first-token');
    });
  });

  describe('handleError', () => {
    it('should call onError callback', () => {
      const onToken = vi.fn();
      const onError = vi.fn();

      service.startVerification(undefined, onToken, onError);
      service.handleError();

      expect(onError).toHaveBeenCalledWith(
        'La vérification de sécurité a échoué — réessaie',
      );
      expect(service.isProcessing()).toBe(false);
      expect(service.shouldRender()).toBe(false);
    });
  });

  describe('timeout behavior', () => {
    it('should bypass verification after timeout', () => {
      const onToken = vi.fn();
      const onError = vi.fn();

      service.startVerification(undefined, onToken, onError);

      vi.advanceTimersByTime(5000);

      expect(onToken).toHaveBeenCalledWith('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Turnstile timeout (5s) - bypassing verification',
      );
    });

    it('should not timeout if already resolved', () => {
      const onToken = vi.fn();
      const onError = vi.fn();

      service.startVerification(undefined, onToken, onError);
      service.handleResolved('valid-token');

      vi.advanceTimersByTime(5000);

      expect(onToken).toHaveBeenCalledTimes(1);
      expect(onToken).toHaveBeenCalledWith('valid-token');
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      const onToken = vi.fn();
      const onError = vi.fn();

      service.startVerification(undefined, onToken, onError);
      expect(service.isProcessing()).toBe(true);

      service.reset();

      expect(service.isProcessing()).toBe(false);
      expect(service.shouldRender()).toBe(false);
    });
  });

  describe('isSafariIOS', () => {
    it('should return false in non-browser environment', () => {
      expect(service.isSafariIOS()).toBe(false);
    });
  });
});
