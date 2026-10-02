import * as SecureStore from "expo-secure-store";

import {
  clearAllKeys,
  clearLegacyClientKey,
  clearSessionKey,
  disableBiometricUnlock,
  enableBiometricUnlock,
  getCachedClientKey,
  hasBiometricKey,
  hasLegacyBiometricKeyCandidate,
  resolveViaBiometric,
  storeClientKey,
} from "./client-key-manager";

const mockStore = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
  canUseBiometricAuthentication: jest.fn(() => true),
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
const BIOMETRIC_MARKER = "pulpe.clientKey.biometric.armed";

const CLIENT_KEY =
  "04b547b25c6ad69f720443670ab3f4c60a33072bda08599d2ce0d1518264a679";

describe("clientKeyManager", () => {
  beforeEach(async () => {
    mockStore.clear();
    jest
      .mocked(SecureStore.canUseBiometricAuthentication)
      .mockReturnValue(true);
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

  it("should remove account secrets and keep biometrics off on sign-out", async () => {
    await storeClientKey(CLIENT_KEY, { enableBiometric: true });

    await clearAllKeys();

    expect(getCachedClientKey()).toBeNull();
    expect(mockStore.has(STANDARD_SLOT)).toBe(false);
    expect(mockStore.has(BIOMETRIC_SLOT)).toBe(false);
    expect(mockStore.get(BIOMETRIC_MARKER)).toBe("0");
    expect(await hasLegacyBiometricKeyCandidate()).toBe(false);
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

  /**
   * On Android, reading an item stored behind authentication prompts whatever
   * the read asks for: expo-secure-store takes the flag from the stored item.
   * Asking whether the slot existed opened a blank biometric prompt at every
   * cold start and every lock.
   */
  it("should answer whether biometrics are armed without touching the gated slot", async () => {
    await storeClientKey(CLIENT_KEY, { enableBiometric: true });
    jest.mocked(SecureStore.getItemAsync).mockClear();

    expect(await hasBiometricKey()).toBe(true);

    expect(SecureStore.getItemAsync).not.toHaveBeenCalledWith(BIOMETRIC_SLOT);
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(BIOMETRIC_MARKER);
  });

  it("should offer a legacy key only for a manual attempt without reading it", async () => {
    mockStore.set(BIOMETRIC_SLOT, CLIENT_KEY);
    jest.mocked(SecureStore.getItemAsync).mockClear();

    expect(await hasBiometricKey()).toBe(false);
    expect(await hasLegacyBiometricKeyCandidate()).toBe(true);
    expect(SecureStore.getItemAsync).not.toHaveBeenCalledWith(BIOMETRIC_SLOT);
    expect(getCachedClientKey()).toBeNull();
  });

  it("should migrate a legacy key after a successful authenticated read", async () => {
    mockStore.set(BIOMETRIC_SLOT, CLIENT_KEY);

    await expect(resolveViaBiometric()).resolves.toBe(CLIENT_KEY);

    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
      BIOMETRIC_SLOT,
      expect.objectContaining({ requireAuthentication: true }),
    );
    expect(mockStore.get(BIOMETRIC_MARKER)).toBe("1");
    expect(await hasBiometricKey()).toBe(true);
    expect(await hasLegacyBiometricKeyCandidate()).toBe(false);
  });

  it("should keep a legacy key out of memory if migration cannot be recorded", async () => {
    mockStore.set(BIOMETRIC_SLOT, CLIENT_KEY);
    const failure = new Error("SecureStore write failed");
    jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(failure);

    await expect(resolveViaBiometric()).rejects.toBe(failure);

    expect(getCachedClientKey()).toBeNull();
    expect(await hasBiometricKey()).toBe(false);
    expect(await hasLegacyBiometricKeyCandidate()).toBe(true);
  });

  it("should preserve a legacy retry when authentication is canceled", async () => {
    mockStore.set(BIOMETRIC_SLOT, CLIENT_KEY);
    jest
      .mocked(SecureStore.getItemAsync)
      .mockRejectedValueOnce(new Error("User canceled the authentication"));

    await expect(resolveViaBiometric()).resolves.toBeNull();

    expect(mockStore.has(BIOMETRIC_MARKER)).toBe(false);
    expect(await hasLegacyBiometricKeyCandidate()).toBe(true);
    expect(getCachedClientKey()).toBeNull();
  });

  it.each([null, "invalid-client-key"])(
    "should stop offering a legacy attempt for an absent or invalid key (%s)",
    async (stored) => {
      if (stored !== null) mockStore.set(BIOMETRIC_SLOT, stored);

      await expect(resolveViaBiometric()).resolves.toBeNull();

      expect(mockStore.get(BIOMETRIC_MARKER)).toBe("0");
      expect(await hasBiometricKey()).toBe(false);
      expect(await hasLegacyBiometricKeyCandidate()).toBe(false);
      expect(mockStore.has(BIOMETRIC_SLOT)).toBe(false);
      expect(getCachedClientKey()).toBeNull();
    },
  );

  it("should hide legacy attempts when device authentication is unavailable", async () => {
    jest
      .mocked(SecureStore.canUseBiometricAuthentication)
      .mockReturnValue(false);

    expect(await hasLegacyBiometricKeyCandidate()).toBe(false);
  });

  it("should keep an explicit opt-out from becoming a legacy candidate", async () => {
    mockStore.set(BIOMETRIC_SLOT, CLIENT_KEY);

    await disableBiometricUnlock();
    await clearSessionKey();

    expect(mockStore.get(BIOMETRIC_MARKER)).toBe("0");
    expect(await hasBiometricKey()).toBe(false);
    expect(await hasLegacyBiometricKeyCandidate()).toBe(false);
  });

  it("should fall back to the PIN when the biometric prompt is dismissed", async () => {
    await storeClientKey(CLIENT_KEY, { enableBiometric: true });
    await clearSessionKey();
    jest
      .mocked(SecureStore.getItemAsync)
      .mockRejectedValueOnce(new Error("User canceled the authentication"));

    await expect(resolveViaBiometric()).resolves.toBeNull();
    // Still offered: a dismissal is not a broken slot.
    expect(await hasBiometricKey()).toBe(true);
  });

  it("should stop offering biometrics once the key has been invalidated", async () => {
    await storeClientKey(CLIENT_KEY, { enableBiometric: true });
    await clearSessionKey();
    // What Android leaves after a new fingerprint is enrolled.
    mockStore.delete(BIOMETRIC_SLOT);

    expect(await resolveViaBiometric()).toBeNull();
    expect(await hasBiometricKey()).toBe(false);
  });

  it("should record the opt-out when dropping the slot", async () => {
    await storeClientKey(CLIENT_KEY, { enableBiometric: true });

    await disableBiometricUnlock();
    expect(await hasBiometricKey()).toBe(false);

    await storeClientKey(CLIENT_KEY, { enableBiometric: true });
    await clearAllKeys();
    expect(mockStore.get(BIOMETRIC_MARKER)).toBe("0");
  });

  it("should remove the biometric secret even when recording opt-out fails", async () => {
    await storeClientKey(CLIENT_KEY, { enableBiometric: true });
    const failure = new Error("SecureStore write failed");
    jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(failure);

    await expect(disableBiometricUnlock()).rejects.toBe(failure);

    expect(mockStore.has(BIOMETRIC_SLOT)).toBe(false);
    expect(getCachedClientKey()).toBe(CLIENT_KEY);
  });

  it("should attempt all secret deletions when sign-out opt-out fails", async () => {
    await storeClientKey(CLIENT_KEY, { enableBiometric: true });
    mockStore.set(STANDARD_SLOT, CLIENT_KEY);
    const failure = new Error("SecureStore write failed");
    jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(failure);

    await expect(clearAllKeys()).rejects.toBe(failure);

    expect(mockStore.has(STANDARD_SLOT)).toBe(false);
    expect(mockStore.has(BIOMETRIC_SLOT)).toBe(false);
    expect(getCachedClientKey()).toBeNull();
  });

  it("should attempt biometric deletion even when legacy key deletion fails", async () => {
    await storeClientKey(CLIENT_KEY, { enableBiometric: true });
    const failure = new Error("SecureStore delete failed");
    jest.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(failure);

    await expect(clearAllKeys()).rejects.toBe(failure);

    expect(mockStore.has(BIOMETRIC_SLOT)).toBe(false);
    expect(mockStore.get(BIOMETRIC_MARKER)).toBe("0");
    expect(getCachedClientKey()).toBeNull();
  });

  it("should preserve the marker failure when secret deletion also fails", async () => {
    const failure = new Error("SecureStore write failed");
    jest.mocked(SecureStore.deleteItemAsync).mockClear();
    jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(failure);
    jest
      .mocked(SecureStore.deleteItemAsync)
      .mockRejectedValueOnce(new Error("SecureStore delete failed"));

    await expect(disableBiometricUnlock()).rejects.toBe(failure);

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(BIOMETRIC_SLOT);
  });
});
