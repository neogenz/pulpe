import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { StorageService } from './storage.service';
import { Logger } from '../logging/logger';

describe('StorageService', () => {
  let service: StorageService;
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    localStorage.clear();

    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        StorageService,
        { provide: Logger, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(StorageService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('get()', () => {
    it('should return data from versioned entry', () => {
      const entry = {
        version: 1,
        data: { name: 'Test Budget', amount: 1500 },
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem('pulpe-test-data', JSON.stringify(entry));

      const result = service.get<{ name: string; amount: number }>(
        'pulpe-test-data',
      );

      expect(result).toEqual({ name: 'Test Budget', amount: 1500 });
    });

    it('should return null for non-existent key', () => {
      const result = service.get('pulpe-non-existent');
      expect(result).toBeNull();
    });

    it('should return null and clear legacy format', () => {
      // Legacy: raw JSON without version wrapper
      localStorage.setItem('pulpe-legacy', JSON.stringify({ data: 'old' }));

      const result = service.get('pulpe-legacy');

      expect(result).toBeNull();
      expect(localStorage.getItem('pulpe-legacy')).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Legacy format'),
      );
    });

    it('should return null and log warning for invalid JSON', () => {
      localStorage.setItem('pulpe-invalid', 'not valid json {');

      const result = service.get('pulpe-invalid');

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('pulpe-invalid'),
        expect.any(Error),
      );
    });
  });

  describe('getString()', () => {
    it('should return string from versioned entry', () => {
      const entry = {
        version: 1,
        data: 'hello',
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem('pulpe-str', JSON.stringify(entry));

      const result = service.getString('pulpe-str');

      expect(result).toBe('hello');
    });

    it('should return null for non-existent key', () => {
      const result = service.getString('pulpe-non-existent');
      expect(result).toBeNull();
    });

    it('should return null and clear legacy raw string', () => {
      localStorage.setItem('pulpe-raw', 'raw-value');

      const result = service.getString('pulpe-raw');

      expect(result).toBeNull();
      expect(localStorage.getItem('pulpe-raw')).toBeNull();
    });
  });

  describe('set()', () => {
    it('should store value with version wrapper', () => {
      service.set('pulpe-budget', { id: '123', name: 'Monthly Budget' });

      const stored = JSON.parse(localStorage.getItem('pulpe-budget')!);
      expect(stored.version).toBe(1);
      expect(stored.data).toEqual({ id: '123', name: 'Monthly Budget' });
      expect(stored.updatedAt).toBeDefined();
    });

    it('should handle complex nested objects', () => {
      const data = {
        user: { id: 1, name: 'Test' },
        items: [{ amount: 100 }, { amount: 200 }],
      };

      service.set('pulpe-complex', data);
      const result = service.get<typeof data>('pulpe-complex');

      expect(result).toEqual(data);
    });

    it('should handle primitive values', () => {
      service.set('pulpe-number', 42);
      service.set('pulpe-boolean', true);

      expect(service.get<number>('pulpe-number')).toBe(42);
      expect(service.get<boolean>('pulpe-boolean')).toBe(true);
    });
  });

  describe('setString()', () => {
    it('should store string with version wrapper', () => {
      service.setString('pulpe-mode', 'dark');

      const stored = JSON.parse(localStorage.getItem('pulpe-mode')!);
      expect(stored.version).toBe(1);
      expect(stored.data).toBe('dark');
    });
  });

  describe('remove()', () => {
    it('should remove key from localStorage', () => {
      service.set('pulpe-to-remove', 'value');
      expect(service.has('pulpe-to-remove')).toBe(true);

      service.remove('pulpe-to-remove');

      expect(localStorage.getItem('pulpe-to-remove')).toBeNull();
    });

    it('should not throw when removing non-existent key', () => {
      expect(() => service.remove('pulpe-non-existent')).not.toThrow();
    });
  });

  describe('has()', () => {
    it('should return true when key exists with valid format', () => {
      service.set('pulpe-exists', 'value');

      const result = service.has('pulpe-exists');

      expect(result).toBe(true);
    });

    it('should return false when key does not exist', () => {
      const result = service.has('pulpe-non-existent');
      expect(result).toBe(false);
    });

    it('should return false for legacy format', () => {
      localStorage.setItem('pulpe-legacy', 'raw-value');

      const result = service.has('pulpe-legacy');

      expect(result).toBe(false);
    });
  });

  describe('clearAllUserData()', () => {
    it('should remove all pulpe- prefixed keys', () => {
      service.set('pulpe-budget', 'data1');
      service.set('pulpe-user', 'data2');
      service.set('pulpe-settings', 'data3');

      service.clearAllUserData();

      expect(localStorage.getItem('pulpe-budget')).toBeNull();
      expect(localStorage.getItem('pulpe-user')).toBeNull();
      expect(localStorage.getItem('pulpe-settings')).toBeNull();
    });

    it('should preserve non-pulpe keys', () => {
      service.set('pulpe-app-data', 'app-data');
      localStorage.setItem('third-party-analytics', 'analytics-data');

      service.clearAllUserData();

      expect(localStorage.getItem('pulpe-app-data')).toBeNull();
      expect(localStorage.getItem('third-party-analytics')).toBe(
        'analytics-data',
      );
    });

    it('should preserve all tour keys (app-scoped)', () => {
      service.set('pulpe-budget', 'budget-data');
      localStorage.setItem('pulpe-tour-intro', 'true');
      localStorage.setItem('pulpe-tour-current-month', 'true');

      service.clearAllUserData();

      expect(localStorage.getItem('pulpe-budget')).toBeNull();
      expect(localStorage.getItem('pulpe-tour-intro')).toBe('true');
      expect(localStorage.getItem('pulpe-tour-current-month')).toBe('true');
    });

    it('should preserve vault client key local (app-scoped device trust)', () => {
      service.set('pulpe-budget', 'budget-data');
      service.setString(
        'pulpe-vault-client-key-local',
        'a'.repeat(64),
        'local',
      );

      service.clearAllUserData();

      expect(localStorage.getItem('pulpe-budget')).toBeNull();
      expect(
        localStorage.getItem('pulpe-vault-client-key-local'),
      ).not.toBeNull();
    });

    it('should handle empty localStorage gracefully', () => {
      localStorage.clear();
      expect(() => service.clearAllUserData()).not.toThrow();
    });

    it('should log the number of cleared items', () => {
      service.set('pulpe-key1', 'data1');
      service.set('pulpe-key2', 'data2');

      service.clearAllUserData();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('2'),
      );
    });
  });

  describe('clearAllAppData()', () => {
    it('should remove tour keys only', () => {
      service.set('pulpe-budget', 'budget-data');
      localStorage.setItem('pulpe-tour-intro', 'true');

      service.clearAllAppData();

      expect(service.has('pulpe-budget')).toBe(true);
      expect(localStorage.getItem('pulpe-tour-intro')).toBeNull();
    });
  });

  describe('Error handling', () => {
    it('should handle localStorage.getItem errors gracefully', () => {
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = () => {
        throw new Error('localStorage disabled');
      };

      const result = service.get('pulpe-test');

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalled();

      localStorage.getItem = originalGetItem;
    });

    it('should handle localStorage.setItem errors gracefully', () => {
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = () => {
        throw new Error('QuotaExceededError');
      };

      expect(() => service.set('pulpe-test', { data: 'value' })).not.toThrow();
      expect(mockLogger.warn).toHaveBeenCalled();

      localStorage.setItem = originalSetItem;
    });

    it('should return false from has() on localStorage error', () => {
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = () => {
        throw new Error('localStorage disabled');
      };

      const result = service.has('pulpe-test');

      expect(result).toBe(false);

      localStorage.getItem = originalGetItem;
    });
  });
});
