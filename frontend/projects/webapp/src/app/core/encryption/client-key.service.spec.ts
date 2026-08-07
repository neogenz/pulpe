import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ClientKeyService } from './client-key.service';
import { StorageService } from '../storage/storage.service';
import { STORAGE_KEYS } from '../storage/storage-keys';

import { DERIVE_CLIENT_KEY } from './crypto.utils';

// Real 64-char hex keys: the service validates through the real
// `isValidClientKeyHex`, so a placeholder like 'local-key' would be rejected
// for the wrong reason and hide what each test is actually asserting.
const SESSION_KEY = 'a1'.repeat(32);
const LOCAL_KEY = 'b2'.repeat(32);
const DERIVED_KEY = 'c3'.repeat(32);
const DIRECT_KEY = 'd4'.repeat(32);
const OTHER_KEY = 'e5'.repeat(32);
const MALFORMED_KEY = 'not-a-hex-key';

describe('ClientKeyService', () => {
  let service: ClientKeyService;
  let mockedDeriveClientKey: Mock;
  let mockStorageService: {
    getString: Mock;
    setString: Mock;
    get: Mock;
    set: Mock;
    remove: Mock;
  };

  beforeEach(() => {
    mockStorageService = {
      getString: vi.fn(),
      setString: vi.fn(),
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(),
      remove: vi.fn(),
    };

    mockedDeriveClientKey = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        ClientKeyService,
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        {
          provide: DERIVE_CLIENT_KEY,
          useValue: mockedDeriveClientKey,
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
      const storedKey = SESSION_KEY;
      mockStorageService.getString.mockReturnValueOnce(storedKey);

      service.initialize();

      expect(mockStorageService.getString).toHaveBeenCalledWith(
        STORAGE_KEYS.VAULT_CLIENT_KEY_SESSION,
        'session',
      );
      expect(service.clientKeyHex()).toBe(storedKey);
    });

    it('should need server validation when restored from sessionStorage (multi-tab stale key)', () => {
      mockStorageService.getString.mockReturnValueOnce(SESSION_KEY);

      service.initialize();

      expect(service.needsServerValidation()).toBe(true);
    });

    it('should skip server validation when validation cache is fresh', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
      mockStorageService.getString.mockReturnValueOnce(SESSION_KEY);
      mockStorageService.get.mockReturnValueOnce(
        new Date('2026-01-15T11:57:00Z').getTime(),
      );

      service.initialize();

      expect(service.needsServerValidation()).toBe(false);
      vi.useRealTimers();
    });

    it('should require server validation when validation cache is expired', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
      mockStorageService.getString.mockReturnValueOnce(SESSION_KEY);
      mockStorageService.get.mockReturnValueOnce(
        new Date('2026-01-15T11:50:00Z').getTime(),
      );

      service.initialize();

      expect(service.needsServerValidation()).toBe(true);
      vi.useRealTimers();
    });

    it('should fallback to localStorage when sessionStorage is empty', () => {
      const storedKey = SESSION_KEY;
      mockStorageService.getString.mockReturnValueOnce(null);
      mockStorageService.getString.mockReturnValueOnce(storedKey);

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
      mockStorageService.getString.mockReturnValueOnce(LOCAL_KEY);

      service.initialize();

      expect(service.needsServerValidation()).toBe(true);
    });

    it('should ignore invalid keys', () => {
      mockStorageService.getString.mockReturnValueOnce(MALFORMED_KEY);
      mockStorageService.getString.mockReturnValueOnce(null);

      service.initialize();

      expect(service.clientKeyHex()).toBeNull();
    });
  });

  describe('markValidated()', () => {
    it('should clear needsServerValidation flag', () => {
      mockStorageService.getString.mockReturnValueOnce(null);
      mockStorageService.getString.mockReturnValueOnce(LOCAL_KEY);

      service.initialize();
      expect(service.needsServerValidation()).toBe(true);

      service.markValidated();
      expect(service.needsServerValidation()).toBe(false);
    });

    it('should persist validation timestamp to sessionStorage', () => {
      service.markValidated();

      expect(mockStorageService.set).toHaveBeenCalledWith(
        STORAGE_KEYS.VAULT_KEY_VALIDATED_AT,
        expect.any(Number),
        'session',
      );
    });
  });

  describe('deriveAndStore()', () => {
    it('should derive key and persist to sessionStorage by default', async () => {
      const derivedKey = DERIVED_KEY;
      mockedDeriveClientKey.mockResolvedValue(derivedKey);

      await service.deriveAndStore('password', 'salt', 100000);

      expect(mockedDeriveClientKey).toHaveBeenCalledWith(
        'password',
        'salt',
        100000,
      );
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
      mockedDeriveClientKey.mockResolvedValue(DERIVED_KEY);

      await service.deriveAndStore('password', 'salt', 100000);

      expect(service.needsServerValidation()).toBe(false);
    });

    it('should persist to localStorage when useLocalStorage=true', async () => {
      const derivedKey = DERIVED_KEY;
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
      service.setDirectKey(DIRECT_KEY);

      expect(mockStorageService.setString).toHaveBeenCalledWith(
        STORAGE_KEYS.VAULT_CLIENT_KEY_SESSION,
        DIRECT_KEY,
        'session',
      );
      expect(mockStorageService.remove).toHaveBeenCalledWith(
        STORAGE_KEYS.VAULT_CLIENT_KEY_LOCAL,
        'local',
      );
    });

    it('should not need server validation (key was just validated by caller)', () => {
      service.setDirectKey(DIRECT_KEY);

      expect(service.needsServerValidation()).toBe(false);
    });

    it('should store in localStorage when useLocalStorage=true', () => {
      service.setDirectKey(DIRECT_KEY, true);

      expect(mockStorageService.setString).toHaveBeenCalledWith(
        STORAGE_KEYS.VAULT_CLIENT_KEY_LOCAL,
        DIRECT_KEY,
        'local',
      );
      expect(mockStorageService.remove).toHaveBeenCalledWith(
        STORAGE_KEYS.VAULT_CLIENT_KEY_SESSION,
        'session',
      );
    });

    it('should throw for invalid key', () => {
      expect(() => service.setDirectKey(MALFORMED_KEY)).toThrow(
        'Invalid client key hex',
      );
    });
  });

  describe('clear()', () => {
    it('should reset signal and remove from both storages', async () => {
      mockedDeriveClientKey.mockResolvedValue(DERIVED_KEY);
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
      mockStorageService.getString.mockReturnValueOnce(LOCAL_KEY);

      service.initialize();
      expect(service.needsServerValidation()).toBe(true);

      service.clear();
      expect(service.needsServerValidation()).toBe(false);
    });
  });

  describe('clearPreservingDeviceTrust()', () => {
    it('should reset signal and remove from sessionStorage only, preserving localStorage', async () => {
      const derivedKey = DERIVED_KEY;
      mockedDeriveClientKey.mockResolvedValue(derivedKey);

      await service.deriveAndStore('password', 'salt', 100000, true);

      service.clearPreservingDeviceTrust();

      expect(service.clientKeyHex()).toBeNull();
      expect(mockStorageService.remove).toHaveBeenCalledWith(
        STORAGE_KEYS.VAULT_CLIENT_KEY_SESSION,
        'session',
      );
      expect(mockStorageService.remove).not.toHaveBeenCalledWith(
        STORAGE_KEYS.VAULT_CLIENT_KEY_LOCAL,
        'local',
      );
    });

    it('should reset needsServerValidation flag', () => {
      mockStorageService.getString.mockReturnValueOnce(null);
      mockStorageService.getString.mockReturnValueOnce(LOCAL_KEY);

      service.initialize();
      expect(service.needsServerValidation()).toBe(true);

      service.clearPreservingDeviceTrust();
      expect(service.needsServerValidation()).toBe(false);
    });

    it('should clear validation cache from sessionStorage', () => {
      service.clearPreservingDeviceTrust();

      expect(mockStorageService.remove).toHaveBeenCalledWith(
        STORAGE_KEYS.VAULT_KEY_VALIDATED_AT,
        'session',
      );
    });
  });

  describe('initialize() - conflicting storages', () => {
    it('should prefer sessionStorage over localStorage when both have valid keys', () => {
      const sessionKey = SESSION_KEY;
      const localKey = LOCAL_KEY;
      mockStorageService.getString
        .mockReturnValueOnce(sessionKey)
        .mockReturnValueOnce(localKey);

      service.initialize();

      expect(service.clientKeyHex()).toBe(sessionKey);
    });

    it('should fallback to localStorage when sessionStorage key is invalid', () => {
      const localKey = LOCAL_KEY;
      mockStorageService.getString
        .mockReturnValueOnce(MALFORMED_KEY)
        .mockReturnValueOnce(localKey);

      service.initialize();

      expect(service.clientKeyHex()).toBe(localKey);
    });
  });

  describe('deriveAndStore() - error paths', () => {
    it('should throw for invalid derived key', async () => {
      mockedDeriveClientKey.mockResolvedValue(MALFORMED_KEY);

      await expect(
        service.deriveAndStore('password', 'salt', 100000),
      ).rejects.toThrow('Invalid client key hex');

      expect(service.clientKeyHex()).toBeNull();
      expect(mockStorageService.setString).not.toHaveBeenCalled();
    });

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

      resolveSecond(OTHER_KEY);
      resolveFirst(DERIVED_KEY);

      await Promise.all([first, second]);

      // Last write wins: first resolved after second, so first-key is final
      expect(service.clientKeyHex()).toBe(DERIVED_KEY);
    });
  });

  describe('setDirectKey() - storage failure', () => {
    it('should not persist to storage when setString silently fails', () => {
      const storedValues = new Map<string, string>();

      // setString silently does nothing (simulates storage quota exceeded)
      mockStorageService.setString.mockImplementation((): void => undefined);
      // getString reads from our map (empty since setString was no-op)
      mockStorageService.getString.mockImplementation(
        (key: string) => storedValues.get(key) ?? null,
      );

      service.setDirectKey(DIRECT_KEY);

      // Key is in memory
      expect(service.clientKeyHex()).toBe(DIRECT_KEY);

      // But storage has nothing — simulate refresh by clearing signal and re-initializing
      service.clear();
      service.initialize();

      // Key is lost because storage never persisted
      expect(service.clientKeyHex()).toBeNull();
    });
  });
});
