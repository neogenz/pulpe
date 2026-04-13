import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import type { NavigationError } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  handleNavigationError,
  isChunkLoadError,
} from './navigation-error-handler';
import { PAGE_RELOAD } from '../lifecycle/page-lifecycle-recovery.service';
import { Logger } from '../logging/logger';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { StorageService } from '../storage/storage.service';

const createNavigationError = (error: unknown): NavigationError =>
  ({
    type: 14,
    id: 1,
    url: '/budget/123',
    error,
  }) as unknown as NavigationError;

describe('isChunkLoadError', () => {
  it('returns true for Safari "Importing a module script failed" message', () => {
    const error = new TypeError('Importing a module script failed.');
    expect(isChunkLoadError(error)).toBe(true);
  });

  it('returns true for Chrome "Failed to fetch dynamically imported module"', () => {
    const error = new TypeError(
      'Failed to fetch dynamically imported module: https://app.pulpe.app/chunk-XYZ.js',
    );
    expect(isChunkLoadError(error)).toBe(true);
  });

  it('returns true for Firefox "error loading dynamically imported module"', () => {
    const error = new TypeError('error loading dynamically imported module');
    expect(isChunkLoadError(error)).toBe(true);
  });

  it('returns true for webpack ChunkLoadError', () => {
    const error = new Error('Loading chunk 5 failed');
    error.name = 'ChunkLoadError';
    expect(isChunkLoadError(error)).toBe(true);
  });

  it('returns false for unrelated TypeError', () => {
    expect(
      isChunkLoadError(new TypeError('Cannot read property x of null')),
    ).toBe(false);
  });

  it('returns false for HttpErrorResponse', () => {
    expect(isChunkLoadError(new HttpErrorResponse({ status: 0 }))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError('Importing a module script failed')).toBe(false);
  });
});

describe('handleNavigationError', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;
  let loggerSpy: {
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
  };
  let storageGetSpy: ReturnType<typeof vi.fn>;
  let storageSetSpy: ReturnType<typeof vi.fn>;
  let mockStorage: {
    getString: typeof storageGetSpy;
    setString: typeof storageSetSpy;
  };

  beforeEach(() => {
    reloadSpy = vi.fn();
    loggerSpy = {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };
    storageGetSpy = vi.fn().mockReturnValue(null);
    storageSetSpy = vi.fn();
    mockStorage = {
      getString: storageGetSpy,
      setString: storageSetSpy,
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: PAGE_RELOAD, useValue: reloadSpy },
        { provide: Logger, useValue: loggerSpy },
        { provide: StorageService, useValue: mockStorage },
      ],
    });
  });

  it('does nothing when navigation error is not a chunk load error', () => {
    const navError = createNavigationError(
      new Error('Resolver returned undefined'),
    );

    TestBed.runInInjectionContext(() => {
      handleNavigationError(navError);
    });

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(storageSetSpy).not.toHaveBeenCalled();
  });

  it('triggers reload and sets guard on first chunk load error', () => {
    const navError = createNavigationError(
      new TypeError('Importing a module script failed.'),
    );

    TestBed.runInInjectionContext(() => {
      handleNavigationError(navError);
    });

    expect(storageGetSpy).toHaveBeenCalledWith(
      STORAGE_KEYS.CHUNK_RELOAD_GUARD,
      'session',
    );
    expect(storageSetSpy).toHaveBeenCalledWith(
      STORAGE_KEYS.CHUNK_RELOAD_GUARD,
      '1',
      'session',
    );
    expect(reloadSpy).toHaveBeenCalledOnce();
  });

  it('does not reload when guard is already set (prevents infinite loop)', () => {
    storageGetSpy.mockReturnValue('1');
    const navError = createNavigationError(
      new TypeError('Failed to fetch dynamically imported module'),
    );

    TestBed.runInInjectionContext(() => {
      handleNavigationError(navError);
    });

    expect(storageGetSpy).toHaveBeenCalledWith(
      STORAGE_KEYS.CHUNK_RELOAD_GUARD,
      'session',
    );
    expect(storageSetSpy).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(loggerSpy.warn).toHaveBeenCalled();
  });
});
