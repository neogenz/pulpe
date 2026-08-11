import {
  clearAllKeys,
  clearSessionKey,
  hasBiometricKey,
  resolveViaBiometric,
  restoreClientKey,
  storeClientKey,
} from "@/core/crypto/client-key-manager";
import { deriveClientKey } from "@/core/crypto/pbkdf2";

import {
  fetchSalt,
  fetchVaultStatus,
  recoverVault,
  setupRecoveryKey,
  validateClientKey,
} from "./vault-api";
import {
  bootstrapVault,
  recoverVaultWithKey,
  setupVaultPin,
  unlockVaultWithBiometrics,
  unlockVaultWithPin,
  useVaultStore,
} from "./vault-store";

/**
 * Explicit factories rather than automocks. Automocking still loads the real
 * module to read its shape, and both of these reach something Jest has no
 * business booting: `pbkdf2.ts` binds to a native module, and `vault-api.ts`
 * pulls in the configured API client, which refuses to load without the
 * `EXPO_PUBLIC_*` values Metro inlines into a real bundle.
 */
jest.mock("./vault-api", () => ({
  fetchSalt: jest.fn(),
  fetchVaultStatus: jest.fn(),
  setupRecoveryKey: jest.fn(),
  validateClientKey: jest.fn(),
  recoverVault: jest.fn(),
}));
jest.mock("@/core/crypto/pbkdf2", () => ({ deriveClientKey: jest.fn() }));
jest.mock("@/core/crypto/client-key-manager");
jest.mock("@/core/query/query-client", () => ({
  queryClient: { clear: jest.fn() },
}));

const CLIENT_KEY =
  "04b547b25c6ad69f720443670ab3f4c60a33072bda08599d2ce0d1518264a679";

const mocked = {
  fetchSalt: jest.mocked(fetchSalt),
  fetchVaultStatus: jest.mocked(fetchVaultStatus),
  setupRecoveryKey: jest.mocked(setupRecoveryKey),
  validateClientKey: jest.mocked(validateClientKey),
  recoverVault: jest.mocked(recoverVault),
  deriveClientKey: jest.mocked(deriveClientKey),
  storeClientKey: jest.mocked(storeClientKey),
  clearSessionKey: jest.mocked(clearSessionKey),
  clearAllKeys: jest.mocked(clearAllKeys),
  restoreClientKey: jest.mocked(restoreClientKey),
  resolveViaBiometric: jest.mocked(resolveViaBiometric),
  hasBiometricKey: jest.mocked(hasBiometricKey),
};

function vaultStatus(pinCodeConfigured: boolean) {
  return {
    pinCodeConfigured,
    recoveryKeyConfigured: pinCodeConfigured,
    vaultCodeConfigured: pinCodeConfigured,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useVaultStore.setState({ status: "unknown", isBiometricAvailable: false });

  mocked.fetchSalt.mockResolvedValue({
    salt: "a1b2",
    kdfIterations: 100_000,
    hasRecoveryKey: false,
  });
  mocked.deriveClientKey.mockResolvedValue(CLIENT_KEY);
  mocked.hasBiometricKey.mockResolvedValue(false);
  mocked.restoreClientKey.mockResolvedValue(null);
});

describe("bootstrapVault", () => {
  it("should ask for setup when no PIN is configured", async () => {
    mocked.fetchVaultStatus.mockResolvedValue(vaultStatus(false));

    await bootstrapVault();

    expect(useVaultStore.getState().status).toBe("setupRequired");
  });

  it("should land unlocked when a stored key comes back", async () => {
    mocked.fetchVaultStatus.mockResolvedValue(vaultStatus(true));
    mocked.restoreClientKey.mockResolvedValue(CLIENT_KEY);

    await bootstrapVault();

    expect(useVaultStore.getState().status).toBe("unlocked");
  });

  it("should land locked when the vault is configured but no key is held", async () => {
    mocked.fetchVaultStatus.mockResolvedValue(vaultStatus(true));
    mocked.hasBiometricKey.mockResolvedValue(true);

    await bootstrapVault();

    expect(useVaultStore.getState()).toMatchObject({
      status: "locked",
      isBiometricAvailable: true,
    });
  });
});

describe("setupVaultPin", () => {
  it("should hold the key before initialising the server-side key check", async () => {
    mocked.setupRecoveryKey.mockResolvedValue({ recoveryKey: "AAAA-BBBB" });

    await setupVaultPin("1234");

    // `setup-recovery` is authorised by the `X-Client-Key` header, so a call
    // that goes out before the key is held initialises the vault under no key.
    expect(mocked.storeClientKey.mock.invocationCallOrder[0]).toBeLessThan(
      mocked.setupRecoveryKey.mock.invocationCallOrder[0],
    );
  });

  it("should return the recovery key and unlock", async () => {
    mocked.setupRecoveryKey.mockResolvedValue({ recoveryKey: "AAAA-BBBB" });

    await expect(setupVaultPin("1234")).resolves.toBe("AAAA-BBBB");
    expect(useVaultStore.getState().status).toBe("unlocked");
  });

  it("should drop the key when setup fails midway", async () => {
    mocked.setupRecoveryKey.mockRejectedValue(new Error("boom"));

    await expect(setupVaultPin("1234")).rejects.toThrow("boom");

    expect(mocked.clearSessionKey).toHaveBeenCalled();
    expect(useVaultStore.getState().status).toBe("setupRequired");
  });
});

describe("unlockVaultWithPin", () => {
  it("should unlock once the server accepts the derived key", async () => {
    mocked.validateClientKey.mockResolvedValue(undefined);

    await unlockVaultWithPin("1234");

    expect(mocked.validateClientKey).toHaveBeenCalledWith(CLIENT_KEY);
    expect(useVaultStore.getState().status).toBe("unlocked");
  });

  it("should stay locked and drop the key on a wrong PIN", async () => {
    mocked.validateClientKey.mockRejectedValue(new Error("invalid"));

    await expect(unlockVaultWithPin("9999")).rejects.toThrow("invalid");

    expect(mocked.clearSessionKey).toHaveBeenCalled();
    expect(useVaultStore.getState().status).toBe("locked");
  });
});

describe("unlockVaultWithBiometrics", () => {
  it("should report a dismissed prompt without changing state", async () => {
    useVaultStore.setState({ status: "locked" });
    mocked.resolveViaBiometric.mockResolvedValue(null);

    await expect(unlockVaultWithBiometrics()).resolves.toBe(false);
    expect(useVaultStore.getState().status).toBe("locked");
  });

  it("should purge the biometric slot when the stored key no longer fits", async () => {
    mocked.resolveViaBiometric.mockResolvedValue(CLIENT_KEY);
    mocked.validateClientKey.mockRejectedValue(new Error("stale key"));

    await expect(unlockVaultWithBiometrics()).rejects.toThrow("stale key");

    expect(mocked.clearAllKeys).toHaveBeenCalled();
    expect(useVaultStore.getState()).toMatchObject({
      status: "locked",
      isBiometricAvailable: false,
    });
  });
});

describe("recoverVaultWithKey", () => {
  it("should rewrap under the new PIN and unlock", async () => {
    mocked.recoverVault.mockResolvedValue({ success: true });

    await recoverVaultWithKey("AAAA-BBBB", "4321");

    expect(mocked.recoverVault).toHaveBeenCalledWith("AAAA-BBBB", CLIENT_KEY);
    expect(mocked.storeClientKey).toHaveBeenCalledWith(CLIENT_KEY, {
      enableBiometric: false,
    });
    expect(useVaultStore.getState().status).toBe("unlocked");
  });
});
