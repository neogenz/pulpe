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

  describe('get() - JSON parsing', () => {
    it('should return parsed JSON value', () => {
      // GIVEN: A JSON object is stored
      const data = { name: 'Test Budget', amount: 1500 };
      localStorage.setItem('pulpe-test-data', JSON.stringify(data));

      // WHEN: Getting the value
      const result = service.get<{ name: string; amount: number }>(
        'pulpe-test-data',
      );

      // THEN: Parsed object is returned
      expect(result).toEqual(data);
    });

    it('should return null for non-existent key', () => {
      // WHEN: Getting a non-existent key
      const result = service.get('pulpe-non-existent');

      // THEN: null is returned
      expect(result).toBeNull();
    });

    it('should return null and log warning for invalid JSON', () => {
      // GIVEN: Invalid JSON is stored
      localStorage.setItem('pulpe-invalid', 'not valid json {');

      // WHEN: Getting the value
      const result = service.get('pulpe-invalid');

      // THEN: null is returned and warning is logged
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('pulpe-invalid'),
        expect.any(Error),
      );
    });

    it('should handle arrays correctly', () => {
      // GIVEN: An array is stored
      const items = ['item1', 'item2', 'item3'];
      localStorage.setItem('pulpe-items', JSON.stringify(items));

      // WHEN: Getting the value
      const result = service.get<string[]>('pulpe-items');

      // THEN: Array is returned
      expect(result).toEqual(items);
    });
  });

  describe('getString() - raw string', () => {
    it('should return raw string value without JSON parsing', () => {
      // GIVEN: A raw string is stored
      localStorage.setItem('pulpe-flag', 'true');

      // WHEN: Getting the string
      const result = service.getString('pulpe-flag');

      // THEN: Raw string is returned (not parsed as boolean)
      expect(result).toBe('true');
      expect(typeof result).toBe('string');
    });

    it('should return null for non-existent key', () => {
      // WHEN: Getting a non-existent key
      const result = service.getString('pulpe-non-existent');

      // THEN: null is returned
      expect(result).toBeNull();
    });
  });

  describe('set() - JSON serialization', () => {
    it('should store JSON-serialized value', () => {
      // GIVEN: An object to store
      const budget = { id: '123', name: 'Monthly Budget' };

      // WHEN: Setting the value
      service.set('pulpe-budget', budget);

      // THEN: Value is stored as JSON
      const stored = localStorage.getItem('pulpe-budget');
      expect(stored).toBe(JSON.stringify(budget));
    });

    it('should handle complex nested objects', () => {
      // GIVEN: A complex nested object
      const data = {
        user: { id: 1, name: 'Test' },
        items: [{ amount: 100 }, { amount: 200 }],
        metadata: { created: '2024-01-01' },
      };

      // WHEN: Setting the value
      service.set('pulpe-complex', data);

      // THEN: Complex object is stored correctly
      const result = service.get<typeof data>('pulpe-complex');
      expect(result).toEqual(data);
    });

    it('should handle primitive values', () => {
      // WHEN: Storing primitive values
      service.set('pulpe-number', 42);
      service.set('pulpe-boolean', true);
      service.set('pulpe-null', null);

      // THEN: Primitives are stored correctly
      expect(service.get<number>('pulpe-number')).toBe(42);
      expect(service.get<boolean>('pulpe-boolean')).toBe(true);
      expect(service.get<null>('pulpe-null')).toBeNull();
    });
  });

  describe('setString() - raw string', () => {
    it('should store raw string without JSON serialization', () => {
      // WHEN: Setting a string value
      service.setString('pulpe-mode', 'true');

      // THEN: Raw string is stored (not JSON quoted)
      const stored = localStorage.getItem('pulpe-mode');
      expect(stored).toBe('true');
      // If it was JSON serialized, it would be '"true"'
      expect(stored).not.toBe('"true"');
    });
  });

  describe('remove()', () => {
    it('should remove key from localStorage', () => {
      // GIVEN: A key exists
      localStorage.setItem('pulpe-to-remove', 'value');
      expect(localStorage.getItem('pulpe-to-remove')).toBe('value');

      // WHEN: Removing the key
      service.remove('pulpe-to-remove');

      // THEN: Key is removed
      expect(localStorage.getItem('pulpe-to-remove')).toBeNull();
    });

    it('should not throw when removing non-existent key', () => {
      // WHEN: Removing a non-existent key
      // THEN: No error is thrown
      expect(() => service.remove('pulpe-non-existent')).not.toThrow();
    });
  });

  describe('has()', () => {
    it('should return true when key exists', () => {
      // GIVEN: A key exists
      localStorage.setItem('pulpe-exists', 'value');

      // WHEN: Checking if key exists
      const result = service.has('pulpe-exists');

      // THEN: true is returned
      expect(result).toBe(true);
    });

    it('should return false when key does not exist', () => {
      // WHEN: Checking a non-existent key
      const result = service.has('pulpe-non-existent');

      // THEN: false is returned
      expect(result).toBe(false);
    });

    it('should return true for empty string value', () => {
      // GIVEN: A key with empty string value
      localStorage.setItem('pulpe-empty', '');

      // WHEN: Checking if key exists
      const result = service.has('pulpe-empty');

      // THEN: true is returned (key exists, even if value is empty)
      expect(result).toBe(true);
    });
  });

  describe('clearAll() - critical for logout security', () => {
    it('should remove all pulpe- prefixed keys', () => {
      // GIVEN: Multiple pulpe keys exist
      localStorage.setItem('pulpe-budget', 'data1');
      localStorage.setItem('pulpe-user', 'data2');
      localStorage.setItem('pulpe-settings', 'data3');

      // WHEN: Clearing all
      service.clearAll();

      // THEN: All pulpe keys are removed
      expect(localStorage.getItem('pulpe-budget')).toBeNull();
      expect(localStorage.getItem('pulpe-user')).toBeNull();
      expect(localStorage.getItem('pulpe-settings')).toBeNull();
    });

    it('should preserve non-pulpe keys (third-party data)', () => {
      // GIVEN: Both pulpe and non-pulpe keys exist
      localStorage.setItem('pulpe-app-data', 'app-data');
      localStorage.setItem('third-party-analytics', 'analytics-data');
      localStorage.setItem('other-app-settings', 'settings-data');

      // WHEN: Clearing all
      service.clearAll();

      // THEN: Only pulpe keys are removed, others preserved
      expect(localStorage.getItem('pulpe-app-data')).toBeNull();
      expect(localStorage.getItem('third-party-analytics')).toBe(
        'analytics-data',
      );
      expect(localStorage.getItem('other-app-settings')).toBe('settings-data');
    });

    it('should handle pulpe_ prefix (underscore variant)', () => {
      // GIVEN: Keys with underscore prefix
      localStorage.setItem('pulpe_legacy_key', 'legacy-data');
      localStorage.setItem('pulpe-new-key', 'new-data');

      // WHEN: Clearing all
      service.clearAll();

      // THEN: Both prefixes are cleared
      expect(localStorage.getItem('pulpe_legacy_key')).toBeNull();
      expect(localStorage.getItem('pulpe-new-key')).toBeNull();
    });

    it('should handle empty localStorage gracefully', () => {
      // GIVEN: localStorage is empty
      localStorage.clear();

      // WHEN: Clearing all
      // THEN: No error is thrown
      expect(() => service.clearAll()).not.toThrow();
    });

    it('should log the number of cleared items', () => {
      // GIVEN: Multiple pulpe keys exist
      localStorage.setItem('pulpe-key1', 'data1');
      localStorage.setItem('pulpe-key2', 'data2');
      localStorage.setItem('pulpe-key3', 'data3');

      // WHEN: Clearing all
      service.clearAll();

      // THEN: Debug log shows count
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('3'),
      );
    });

    it('should remove all tour keys when no userId is provided', () => {
      // GIVEN: Both regular and tour keys exist
      localStorage.setItem('pulpe-budget', 'budget-data');
      localStorage.setItem('pulpe-tour-intro-user1', 'true');
      localStorage.setItem('pulpe-tour-intro-user2', 'true');

      // WHEN: Clearing all without userId
      service.clearAll();

      // THEN: All pulpe keys including tour keys are removed
      expect(localStorage.getItem('pulpe-budget')).toBeNull();
      expect(localStorage.getItem('pulpe-tour-intro-user1')).toBeNull();
      expect(localStorage.getItem('pulpe-tour-intro-user2')).toBeNull();
    });

    it('should preserve only current user tour keys when userId is provided', () => {
      // GIVEN: Tour keys for multiple users exist
      const currentUserId = 'abc-123';
      localStorage.setItem('pulpe-budget', 'budget-data');
      localStorage.setItem(`pulpe-tour-intro-${currentUserId}`, 'true');
      localStorage.setItem(`pulpe-tour-month-${currentUserId}`, 'true');
      localStorage.setItem('pulpe-tour-intro-other-user-456', 'true');
      localStorage.setItem('pulpe-tour-month-xyz-789', 'true');

      // WHEN: Clearing all with current userId
      service.clearAll(currentUserId);

      // THEN: Regular keys are removed, only current user's tour keys are preserved
      expect(localStorage.getItem('pulpe-budget')).toBeNull();
      expect(localStorage.getItem(`pulpe-tour-intro-${currentUserId}`)).toBe(
        'true',
      );
      expect(localStorage.getItem(`pulpe-tour-month-${currentUserId}`)).toBe(
        'true',
      );
      // Other users' tour keys are removed
      expect(
        localStorage.getItem('pulpe-tour-intro-other-user-456'),
      ).toBeNull();
      expect(localStorage.getItem('pulpe-tour-month-xyz-789')).toBeNull();
    });

    it('should handle shared device scenario - prevent tour data leak', () => {
      // GIVEN: Alice logged out previously, Bob's tour keys remain
      localStorage.setItem('pulpe-tour-intro-alice-123', 'true');
      localStorage.setItem('pulpe-tour-intro-bob-456', 'true');
      localStorage.setItem('pulpe-budget', 'bob-budget');

      // WHEN: Bob logs out with his userId
      service.clearAll('bob-456');

      // THEN: Only Bob's tour keys remain, Alice's are cleaned up
      expect(localStorage.getItem('pulpe-tour-intro-bob-456')).toBe('true');
      expect(localStorage.getItem('pulpe-tour-intro-alice-123')).toBeNull();
      expect(localStorage.getItem('pulpe-budget')).toBeNull();
    });
  });

  describe('Error handling - localStorage failures', () => {
    it('should handle localStorage.getItem errors gracefully', () => {
      // GIVEN: localStorage throws on getItem
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = () => {
        throw new Error('localStorage disabled');
      };

      // WHEN: Getting a value
      const result = service.get('pulpe-test');

      // THEN: null is returned and warning is logged
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalled();

      // Cleanup
      Storage.prototype.getItem = originalGetItem;
    });

    it('should handle localStorage.setItem errors gracefully', () => {
      // GIVEN: localStorage throws on setItem (e.g., quota exceeded)
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = () => {
        throw new Error('QuotaExceededError');
      };

      // WHEN: Setting a value
      // THEN: No error is thrown
      expect(() => service.set('pulpe-test', { data: 'value' })).not.toThrow();
      expect(mockLogger.warn).toHaveBeenCalled();

      // Cleanup
      Storage.prototype.setItem = originalSetItem;
    });

    it('should handle localStorage.removeItem errors gracefully', () => {
      // GIVEN: localStorage throws on removeItem
      const originalRemoveItem = Storage.prototype.removeItem;
      Storage.prototype.removeItem = () => {
        throw new Error('localStorage error');
      };

      // WHEN: Removing a value
      // THEN: No error is thrown
      expect(() => service.remove('pulpe-test')).not.toThrow();
      expect(mockLogger.warn).toHaveBeenCalled();

      // Cleanup
      Storage.prototype.removeItem = originalRemoveItem;
    });

    it('should return false from has() on localStorage error', () => {
      // GIVEN: localStorage throws on getItem
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = () => {
        throw new Error('localStorage disabled');
      };

      // WHEN: Checking if key exists
      const result = service.has('pulpe-test');

      // THEN: false is returned (safe default)
      expect(result).toBe(false);

      // Cleanup
      Storage.prototype.getItem = originalGetItem;
    });

    it('should handle getString() errors gracefully', () => {
      // GIVEN: localStorage throws on getItem
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = () => {
        throw new Error('localStorage disabled');
      };

      // WHEN: Getting a string
      const result = service.getString('pulpe-test');

      // THEN: null is returned
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalled();

      // Cleanup
      Storage.prototype.getItem = originalGetItem;
    });

    it('should handle setString() errors gracefully', () => {
      // GIVEN: localStorage throws on setItem
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = () => {
        throw new Error('QuotaExceededError');
      };

      // WHEN: Setting a string
      // THEN: No error is thrown
      expect(() => service.setString('pulpe-test', 'value')).not.toThrow();
      expect(mockLogger.warn).toHaveBeenCalled();

      // Cleanup
      Storage.prototype.setItem = originalSetItem;
    });

    it('should handle clearAll() errors gracefully', () => {
      // GIVEN: localStorage throws on removeItem
      const originalRemoveItem = Storage.prototype.removeItem;
      localStorage.setItem('pulpe-key', 'value');
      Storage.prototype.removeItem = () => {
        throw new Error('localStorage error');
      };

      // WHEN: Clearing all
      // THEN: No error is thrown (error is logged)
      expect(() => service.clearAll()).not.toThrow();
      expect(mockLogger.warn).toHaveBeenCalled();

      // Cleanup
      Storage.prototype.removeItem = originalRemoveItem;
    });
  });
});
