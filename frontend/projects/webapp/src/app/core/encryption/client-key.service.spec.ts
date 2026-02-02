import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ClientKeyService } from './client-key.service';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';

vi.mock('@core/encryption/crypto.utils', () => ({
  deriveClientKey: vi.fn(),
  isValidClientKeyHex: vi.fn(),
}));

import {
  deriveClientKey,
  isValidClientKeyHex,
} from '@core/encryption/crypto.utils';

const mockedDeriveClientKey = deriveClientKey as Mock;
const mockedIsValidClientKeyHex = isValidClientKeyHex as Mock;

describe('ClientKeyService', () => {
  let service: ClientKeyService;
  let mockStorageService: {
    getString: Mock;
    setString: Mock;
    remove: Mock;
  };

  beforeEach(() => {
    mockStorageService = {
      getString: vi.fn(),
      setString: vi.fn(),
      remove: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        ClientKeyService,
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
      ],
    });

    service = TestBed.inject(ClientKeyService);
  });

  it('should start with null clientKey', () => {
    expect(service.clientKeyHex()).toBeNull();
  });

  it('hasClientKey should be false initially', () => {
    expect(service.hasClientKey()).toBe(false);
  });

  describe('initialize()', () => {
    it('should restore key from sessionStorage first', () => {
      const storedKey = 'deadbeef1234567890abcdef';
      mockStorageService.getString.mockReturnValueOnce(storedKey);
      mockedIsValidClientKeyHex.mockReturnValue(true);

      service.initialize();

      expect(mockStorageService.getString).toHaveBeenCalledWith(
        STORAGE_KEYS.VAULT_CLIENT_KEY_SESSION,
        'session',
      );
      expect(service.clientKeyHex()).toBe(storedKey);
    });

    it('should fallback to localStorage when sessionStorage is empty', () => {
      const storedKey = 'deadbeef1234567890abcdef';
      mockStorageService.getString.mockReturnValueOnce(null);
      mockStorageService.getString.mockReturnValueOnce(storedKey);
      mockedIsValidClientKeyHex.mockReturnValue(true);

      service.initialize();

      expect(mockStorageService.getString).toHaveBeenNthCalledWith(
        1,
        STORAGE_KEYS.VAULT_CLIENT_KEY_SESSION,
        'session',
      );
      expect(mockStorageService.getString).toHaveBeenNthCalledWith(
        2,
        STORAGE_KEYS.VAULT_CLIENT_KEY_LOCAL,
        'local',
      );
      expect(service.clientKeyHex()).toBe(storedKey);
    });

    it('should ignore invalid keys', () => {
      mockStorageService.getString.mockReturnValueOnce('invalid-key');
      mockedIsValidClientKeyHex.mockReturnValue(false);
      mockStorageService.getString.mockReturnValueOnce(null);

      service.initialize();

      expect(service.clientKeyHex()).toBeNull();
    });
  });

  describe('deriveAndStore()', () => {
    it('should derive key and persist to sessionStorage by default', async () => {
      const derivedKey = 'derived-key-hex';
      mockedDeriveClientKey.mockResolvedValue(derivedKey);

      await service.deriveAndStore('password', 'salt', 100000);

      expect(deriveClientKey).toHaveBeenCalledWith('password', 'salt', 100000);
      expect(service.clientKeyHex()).toBe(derivedKey);
      expect(mockStorageService.setString).toHaveBeenCalledWith(
        STORAGE_KEYS.VAULT_CLIENT_KEY_SESSION,
        derivedKey,
        'session',
      );
      expect(mockStorageService.remove).toHaveBeenCalledWith(
        STORAGE_KEYS.VAULT_CLIENT_KEY_LOCAL,
        'local',
      );
    });

    it('should persist to localStorage when useLocalStorage=true', async () => {
      const derivedKey = 'derived-key-hex';
      mockedDeriveClientKey.mockResolvedValue(derivedKey);

      await service.deriveAndStore('password', 'salt', 100000, true);

      expect(mockStorageService.setString).toHaveBeenCalledWith(
        STORAGE_KEYS.VAULT_CLIENT_KEY_LOCAL,
        derivedKey,
        'local',
      );
      expect(mockStorageService.remove).toHaveBeenCalledWith(
        STORAGE_KEYS.VAULT_CLIENT_KEY_SESSION,
        'session',
      );
    });
  });

  describe('setDirectKey()', () => {
    it('should store in sessionStorage by default', () => {
      mockedIsValidClientKeyHex.mockReturnValue(true);

      service.setDirectKey('valid-key-hex');

      expect(mockStorageService.setString).toHaveBeenCalledWith(
        STORAGE_KEYS.VAULT_CLIENT_KEY_SESSION,
        'valid-key-hex',
        'session',
      );
      expect(mockStorageService.remove).toHaveBeenCalledWith(
        STORAGE_KEYS.VAULT_CLIENT_KEY_LOCAL,
        'local',
      );
    });

    it('should store in localStorage when useLocalStorage=true', () => {
      mockedIsValidClientKeyHex.mockReturnValue(true);

      service.setDirectKey('valid-key-hex', true);

      expect(mockStorageService.setString).toHaveBeenCalledWith(
        STORAGE_KEYS.VAULT_CLIENT_KEY_LOCAL,
        'valid-key-hex',
        'local',
      );
      expect(mockStorageService.remove).toHaveBeenCalledWith(
        STORAGE_KEYS.VAULT_CLIENT_KEY_SESSION,
        'session',
      );
    });

    it('should throw for invalid key', () => {
      mockedIsValidClientKeyHex.mockReturnValue(false);

      expect(() => service.setDirectKey('bad')).toThrow(
        'Invalid client key hex',
      );
    });
  });

  describe('clear()', () => {
    it('should reset signal and remove from both storages', async () => {
      mockedDeriveClientKey.mockResolvedValue('key');
      await service.deriveAndStore('p', 's', 1);

      service.clear();

      expect(service.clientKeyHex()).toBeNull();
      expect(mockStorageService.remove).toHaveBeenCalledWith(
        STORAGE_KEYS.VAULT_CLIENT_KEY_SESSION,
        'session',
      );
      expect(mockStorageService.remove).toHaveBeenCalledWith(
        STORAGE_KEYS.VAULT_CLIENT_KEY_LOCAL,
        'local',
      );
    });
  });
});
