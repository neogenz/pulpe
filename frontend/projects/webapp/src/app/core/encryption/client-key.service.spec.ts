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

const mockedDeriveClientKey = vi.mocked(deriveClientKey);
const mockedIsValidClientKeyHex = vi.mocked(isValidClientKeyHex);

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

  it('needsServerValidation should be false initially', () => {
    expect(service.needsServerValidation()).toBe(false);
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

    it('should need server validation when restored from sessionStorage (multi-tab stale key)', () => {
      mockStorageService.getString.mockReturnValueOnce('session-key');
      mockedIsValidClientKeyHex.mockReturnValue(true);

      service.initialize();

      expect(service.needsServerValidation()).toBe(true);
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

    it('should need server validation when restored from localStorage', () => {
      mockStorageService.getString.mockReturnValueOnce(null);
      mockStorageService.getString.mockReturnValueOnce('local-key');
      mockedIsValidClientKeyHex.mockReturnValue(true);

      service.initialize();

      expect(service.needsServerValidation()).toBe(true);
    });

    it('should ignore invalid keys', () => {
      mockStorageService.getString.mockReturnValueOnce('invalid-key');
      mockedIsValidClientKeyHex.mockReturnValue(false);
      mockStorageService.getString.mockReturnValueOnce(null);

      service.initialize();

      expect(service.clientKeyHex()).toBeNull();
    });
  });

  describe('markValidated()', () => {
    it('should clear needsServerValidation flag', () => {
      mockStorageService.getString.mockReturnValueOnce(null);
      mockStorageService.getString.mockReturnValueOnce('local-key');
      mockedIsValidClientKeyHex.mockReturnValue(true);

      service.initialize();
      expect(service.needsServerValidation()).toBe(true);

      service.markValidated();
      expect(service.needsServerValidation()).toBe(false);
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

    it('should not need server validation (key was just derived from user input)', async () => {
      mockedDeriveClientKey.mockResolvedValue('derived-key');

      await service.deriveAndStore('password', 'salt', 100000);

      expect(service.needsServerValidation()).toBe(false);
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

    it('should not need server validation (key was just validated by caller)', () => {
      mockedIsValidClientKeyHex.mockReturnValue(true);

      service.setDirectKey('valid-key-hex');

      expect(service.needsServerValidation()).toBe(false);
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

    it('should reset needsServerValidation flag', () => {
      mockStorageService.getString.mockReturnValueOnce(null);
      mockStorageService.getString.mockReturnValueOnce('local-key');
      mockedIsValidClientKeyHex.mockReturnValue(true);

      service.initialize();
      expect(service.needsServerValidation()).toBe(true);

      service.clear();
      expect(service.needsServerValidation()).toBe(false);
    });
  });

  describe('initialize() - conflicting storages', () => {
    it('should prefer sessionStorage over localStorage when both have valid keys', () => {
      const sessionKey = 'session-key-hex-value';
      const localKey = 'local-key-hex-value';
      mockStorageService.getString
        .mockReturnValueOnce(sessionKey)
        .mockReturnValueOnce(localKey);
      mockedIsValidClientKeyHex.mockReturnValue(true);

      service.initialize();

      expect(service.clientKeyHex()).toBe(sessionKey);
    });

    it('should fallback to localStorage when sessionStorage key is invalid', () => {
      const localKey = 'local-key-hex-value';
      mockStorageService.getString
        .mockReturnValueOnce('invalid-session-key')
        .mockReturnValueOnce(localKey);
      mockedIsValidClientKeyHex
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      service.initialize();

      expect(service.clientKeyHex()).toBe(localKey);
    });
  });

  describe('deriveAndStore() - error paths', () => {
    it('should not persist key when deriveClientKey rejects', async () => {
      mockedDeriveClientKey.mockRejectedValue(new Error('Derivation failed'));

      await expect(
        service.deriveAndStore('password', 'salt', 100000),
      ).rejects.toThrow('Derivation failed');

      expect(service.clientKeyHex()).toBeNull();
      expect(mockStorageService.setString).not.toHaveBeenCalled();
    });

    it('should resolve both promises when two deriveAndStore calls race', async () => {
      let resolveFirst!: (v: string) => void;
      let resolveSecond!: (v: string) => void;

      mockedDeriveClientKey
        .mockReturnValueOnce(
          new Promise<string>((r) => {
            resolveFirst = r;
          }),
        )
        .mockReturnValueOnce(
          new Promise<string>((r) => {
            resolveSecond = r;
          }),
        );

      const first = service.deriveAndStore('pw1', 'salt', 1);
      const second = service.deriveAndStore('pw2', 'salt', 1);

      resolveSecond('second-key');
      resolveFirst('first-key');

      await Promise.all([first, second]);

      // Last write wins: first resolved after second, so first-key is final
      expect(service.clientKeyHex()).toBe('first-key');
    });
  });

  describe('setDirectKey() - storage failure', () => {
    it('should not persist to storage when setString silently fails', () => {
      mockedIsValidClientKeyHex.mockReturnValue(true);
      const storedValues = new Map<string, string>();

      // setString silently does nothing (simulates storage quota exceeded)
      mockStorageService.setString.mockImplementation((): void => undefined);
      // getString reads from our map (empty since setString was no-op)
      mockStorageService.getString.mockImplementation(
        (key: string) => storedValues.get(key) ?? null,
      );

      service.setDirectKey('valid-key-hex');

      // Key is in memory
      expect(service.clientKeyHex()).toBe('valid-key-hex');

      // But storage has nothing — simulate refresh by clearing signal and re-initializing
      service.clear();
      service.initialize();

      // Key is lost because storage never persisted
      expect(service.clientKeyHex()).toBeNull();
    });
  });
});
