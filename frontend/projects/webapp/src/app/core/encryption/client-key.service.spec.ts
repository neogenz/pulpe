import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  afterEach,
  type Mock,
} from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ClientKeyService } from './client-key.service';

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
  let getItemSpy: ReturnType<typeof vi.spyOn>;
  let setItemSpy: ReturnType<typeof vi.spyOn>;
  let removeItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ClientKeyService],
    });

    service = TestBed.inject(ClientKeyService);

    getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockReturnValue(undefined);
    removeItemSpy = vi
      .spyOn(Storage.prototype, 'removeItem')
      .mockReturnValue(undefined);

    vi.clearAllMocks();
  });

  afterEach(() => {
    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
    removeItemSpy.mockRestore();
  });

  it('should start with null clientKey', () => {
    expect(service.clientKeyHex()).toBeNull();
  });

  it('hasClientKey should be false initially', () => {
    expect(service.hasClientKey()).toBe(false);
  });

  it('initialize() should restore key from sessionStorage', () => {
    const storedKey = 'deadbeef1234567890abcdef';
    getItemSpy.mockReturnValue(storedKey);
    mockedIsValidClientKeyHex.mockReturnValue(true);

    service.initialize();

    expect(getItemSpy).toHaveBeenCalledWith('pulpe:client-key');
    expect(isValidClientKeyHex).toHaveBeenCalledWith(storedKey);
    expect(service.clientKeyHex()).toBe(storedKey);
  });

  it('initialize() should ignore invalid keys in sessionStorage', () => {
    const invalidKey = 'invalid-key';
    getItemSpy.mockReturnValue(invalidKey);
    mockedIsValidClientKeyHex.mockReturnValue(false);

    service.initialize();

    expect(service.clientKeyHex()).toBeNull();
    expect(service.hasClientKey()).toBe(false);
  });

  it('deriveAndStore() should derive key and update signal', async () => {
    const password = 'test-password';
    const salt = 'test-salt';
    const iterations = 100000;
    const derivedKey = 'derived-key-hex';

    mockedDeriveClientKey.mockResolvedValue(derivedKey);

    await service.deriveAndStore(password, salt, iterations);

    expect(deriveClientKey).toHaveBeenCalledWith(password, salt, iterations);
    expect(service.clientKeyHex()).toBe(derivedKey);
  });

  it('deriveAndStore() should persist to sessionStorage', async () => {
    const derivedKey = 'derived-key-hex';
    mockedDeriveClientKey.mockResolvedValue(derivedKey);

    await service.deriveAndStore('test-password', 'test-salt', 100000);

    expect(setItemSpy).toHaveBeenCalledWith('pulpe:client-key', derivedKey);
  });

  it('clear() should reset signal to null and remove from sessionStorage', async () => {
    const derivedKey = 'derived-key-hex';
    mockedDeriveClientKey.mockResolvedValue(derivedKey);
    await service.deriveAndStore('password', 'salt', 100000);

    expect(service.clientKeyHex()).toBe(derivedKey);

    service.clear();

    expect(service.clientKeyHex()).toBeNull();
    expect(removeItemSpy).toHaveBeenCalledWith('pulpe:client-key');
  });

  it('clear() should handle sessionStorage errors gracefully', async () => {
    const derivedKey = 'derived-key-hex';
    mockedDeriveClientKey.mockResolvedValue(derivedKey);
    await service.deriveAndStore('password', 'salt', 100000);

    removeItemSpy.mockImplementation(() => {
      throw new Error('sessionStorage unavailable');
    });

    expect(() => service.clear()).not.toThrow();
    expect(service.clientKeyHex()).toBeNull();
  });
});
