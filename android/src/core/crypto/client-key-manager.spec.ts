import {
  clearAllKeys,
  clearLegacyClientKey,
  clearSessionKey,
  disableBiometricUnlock,
  enableBiometricUnlock,
  getCachedClientKey,
  hasBiometricKey,
  resolveViaBiometric,
  storeClientKey,
} from "./client-key-manager";

const mockStore = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

const STANDARD_SLOT = "pulpe.clientKey";
const BIOMETRIC_SLOT = "pulpe.clientKey.biometric";

const CLIENT_KEY =
  "04b547b25c6ad69f720443670ab3f4c60a33072bda08599d2ce0d1518264a679";

describe("clientKeyManager", () => {
  beforeEach(async () => {
    mockStore.clear();
    await clearAllKeys();
    mockStore.clear();
  });

  it("should expose the key synchronously once stored", async () => {
    await storeClientKey(CLIENT_KEY, { enableBiometric: false });

    expect(getCachedClientKey()).toBe(CLIENT_KEY);
  });

  it("should not write the biometric slot unless asked", async () => {
    await storeClientKey(CLIENT_KEY, { enableBiometric: false });

    expect(mockStore.has(BIOMETRIC_SLOT)).toBe(false);
    expect(await hasBiometricKey()).toBe(false);
  });

  it("should persist only the authenticated slot when biometrics are enabled", async () => {
    await storeClientKey(CLIENT_KEY, { enableBiometric: true });

    expect(mockStore.has(STANDARD_SLOT)).toBe(false);
    expect(mockStore.get(BIOMETRIC_SLOT)).toBe(CLIENT_KEY);
  });

  it("should delete a legacy ungated key on cold start", async () => {
    mockStore.set(STANDARD_SLOT, CLIENT_KEY);

    await clearLegacyClientKey();

    expect(getCachedClientKey()).toBeNull();
    expect(mockStore.has(STANDARD_SLOT)).toBe(false);
  });

  it("should keep biometric unlock available after the vault locks", async () => {
    await storeClientKey(CLIENT_KEY, { enableBiometric: true });

    await clearSessionKey();

    expect(getCachedClientKey()).toBeNull();
    expect(mockStore.has(STANDARD_SLOT)).toBe(false);
    expect(await hasBiometricKey()).toBe(true);
  });

  it("should keep a biometric unlock in memory only", async () => {
    await storeClientKey(CLIENT_KEY, { enableBiometric: true });
    await clearSessionKey();

    await expect(resolveViaBiometric()).resolves.toBe(CLIENT_KEY);
    expect(getCachedClientKey()).toBe(CLIENT_KEY);
    expect(mockStore.has(STANDARD_SLOT)).toBe(false);
  });

  it("should remove every slot on sign-out", async () => {
    await storeClientKey(CLIENT_KEY, { enableBiometric: true });

    await clearAllKeys();

    expect(getCachedClientKey()).toBeNull();
    expect(mockStore.size).toBe(0);
  });

  it("should refuse to enable biometric unlock with no key in hand", async () => {
    await expect(enableBiometricUnlock()).resolves.toBe(false);
    expect(mockStore.has(BIOMETRIC_SLOT)).toBe(false);
  });

  it("should leave the session usable after biometric unlock is turned off", async () => {
    await storeClientKey(CLIENT_KEY, { enableBiometric: true });

    await disableBiometricUnlock();

    expect(await hasBiometricKey()).toBe(false);
    expect(getCachedClientKey()).toBe(CLIENT_KEY);
  });
});
