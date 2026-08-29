import { API_ERROR_CODES } from "pulpe-shared";

import { ApiError } from "@/core/api/api-error";
import {
  clearAllKeys,
  clearLegacyClientKey,
  clearSessionKey,
  disableBiometricUnlock,
  enableBiometricUnlock,
  hasBiometricKey,
  resolveViaBiometric,
  storeClientKey,
} from "@/core/crypto/client-key-manager";
import { deriveClientKey } from "@/core/crypto/pbkdf2";

import {
  changePin,
  fetchSalt,
  fetchVaultStatus,
  recoverVault,
  regenerateRecoveryKey,
  setupRecoveryKey,
  validateClientKey,
} from "./vault-api";
import {
  bootstrapVault,
  changeVaultPin,
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
  regenerateRecoveryKey: jest.fn(),
  changePin: jest.fn(),
  verifyRecoveryKey: jest.fn(),
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
  regenerateRecoveryKey: jest.mocked(regenerateRecoveryKey),
  deriveClientKey: jest.mocked(deriveClientKey),
  storeClientKey: jest.mocked(storeClientKey),
  clearSessionKey: jest.mocked(clearSessionKey),
  clearAllKeys: jest.mocked(clearAllKeys),
  clearLegacyClientKey: jest.mocked(clearLegacyClientKey),
  resolveViaBiometric: jest.mocked(resolveViaBiometric),
  hasBiometricKey: jest.mocked(hasBiometricKey),
  changePin: jest.mocked(changePin),
  enableBiometricUnlock: jest.mocked(enableBiometricUnlock),
  disableBiometricUnlock: jest.mocked(disableBiometricUnlock),
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
  useVaultStore.setState({
    status: "unknown",
    isBiometricAvailable: false,
    hasBootstrapError: false,
    pendingRecoveryNotice: null,
  });

  mocked.fetchSalt.mockResolvedValue({
    salt: "a1b2",
    kdfIterations: 100_000,
    hasRecoveryKey: false,
  });
  mocked.deriveClientKey.mockResolvedValue(CLIENT_KEY);
  mocked.hasBiometricKey.mockResolvedValue(false);
  mocked.clearLegacyClientKey.mockResolvedValue(undefined);
});

describe("bootstrapVault", () => {
  it("should ask for setup when no PIN is configured", async () => {
    mocked.fetchVaultStatus.mockResolvedValue(vaultStatus(false));

    await expect(bootstrapVault()).resolves.toBe("setupRequired");

    expect(useVaultStore.getState().status).toBe("setupRequired");
  });

  it("should delete a legacy key and land locked after a cold start", async () => {
    mocked.fetchVaultStatus.mockResolvedValue(vaultStatus(true));

    await expect(bootstrapVault()).resolves.toBe("locked");

    expect(mocked.clearLegacyClientKey).toHaveBeenCalled();
    expect(useVaultStore.getState().status).toBe("locked");
  });

  it("should land locked when the vault is configured but no key is held", async () => {
    mocked.fetchVaultStatus.mockResolvedValue(vaultStatus(true));
    mocked.hasBiometricKey.mockResolvedValue(true);

    await expect(bootstrapVault()).resolves.toBe("locked");

    expect(useVaultStore.getState()).toMatchObject({
      status: "locked",
      isBiometricAvailable: true,
    });
  });

  it("should surface a failure as state rather than rejecting", async () => {
    // The router waits on this state; a rejection nobody catches would leave
    // it on a blank screen with no way forward.
    mocked.fetchVaultStatus.mockRejectedValue(new Error("offline"));

    await expect(bootstrapVault()).resolves.toBe("unknown");

    expect(useVaultStore.getState()).toMatchObject({
      status: "unknown",
      hasBootstrapError: true,
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

  it("should hold the recovery key for acknowledgement and unlock", async () => {
    mocked.setupRecoveryKey.mockResolvedValue({ recoveryKey: "AAAA-BBBB" });

    await setupVaultPin("1234");

    expect(useVaultStore.getState()).toMatchObject({
      status: "unlocked",
      pendingRecoveryNotice: { kind: "minted", recoveryKey: "AAAA-BBBB" },
    });
  });

  it("should drop the key when setup fails midway", async () => {
    mocked.setupRecoveryKey.mockRejectedValue(new Error("boom"));

    await expect(setupVaultPin("1234")).rejects.toThrow("boom");

    expect(mocked.clearSessionKey).toHaveBeenCalled();
    expect(useVaultStore.getState().status).toBe("setupRequired");
  });

  it("should relock instead of re-asking for a PIN when the server refuses a second setup", async () => {
    useVaultStore.setState({ status: "setupRequired" });
    mocked.setupRecoveryKey.mockRejectedValue(
      new ApiError(
        "exists",
        API_ERROR_CODES.RECOVERY_KEY_ALREADY_EXISTS,
        409,
        undefined,
      ),
    );
    mocked.fetchVaultStatus.mockResolvedValue(vaultStatus(true));

    await expect(setupVaultPin("1234")).rejects.toThrow("exists");

    expect(mocked.clearSessionKey).toHaveBeenCalled();
    expect(useVaultStore.getState().status).toBe("locked");
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
  beforeEach(() => {
    mocked.recoverVault.mockResolvedValue({ success: true });
    mocked.regenerateRecoveryKey.mockResolvedValue({
      recoveryKey: "CCCC-DDDD",
    });
  });

  it("should rewrap under the new PIN and unlock", async () => {
    await recoverVaultWithKey("AAAA-BBBB", "4321");

    expect(mocked.recoverVault).toHaveBeenCalledWith("AAAA-BBBB", CLIENT_KEY);
    expect(mocked.storeClientKey).toHaveBeenCalledWith(CLIENT_KEY, {
      enableBiometric: false,
    });
    expect(useVaultStore.getState().status).toBe("unlocked");
  });

  it("should replace the recovery key it just spent", async () => {
    await recoverVaultWithKey("AAAA-BBBB", "4321");

    expect(useVaultStore.getState().pendingRecoveryNotice).toEqual({
      kind: "minted",
      recoveryKey: "CCCC-DDDD",
    });
  });

  it("should still unlock when the replacement key cannot be minted", async () => {
    // Past the commit point: the vault is already rewrapped, so this costs a
    // recovery key, never access.
    mocked.regenerateRecoveryKey.mockRejectedValue(new Error("boom"));

    await expect(
      recoverVaultWithKey("AAAA-BBBB", "4321"),
    ).resolves.toBeUndefined();

    expect(useVaultStore.getState()).toMatchObject({
      status: "unlocked",
      pendingRecoveryNotice: { kind: "mintFailed" },
    });
  });
});

describe("changeVaultPin", () => {
  const NEW_CLIENT_KEY =
    "1f9f3b0d5e2a4c6b8d0f2a4c6e8a0c2e4a6c8e0a2c4e6a8c0e2a4c6e8a0c2e4a";

  beforeEach(() => {
    mocked.changePin.mockResolvedValue({
      keyCheck: "check",
      recoveryKey: "EEEE-FFFF",
    });
    // The two derivations differ, so the call the server sees can be asserted
    // rather than inferred from a single value standing in for both PINs.
    mocked.deriveClientKey.mockImplementation((pin: string) =>
      Promise.resolve(pin === "1234" ? CLIENT_KEY : NEW_CLIENT_KEY),
    );
  });

  it("should send both keys and keep the device slot on the new one", async () => {
    await changeVaultPin("1234", "4321");

    expect(mocked.changePin).toHaveBeenCalledWith(CLIENT_KEY, NEW_CLIENT_KEY);
    expect(mocked.storeClientKey).toHaveBeenCalledWith(NEW_CLIENT_KEY, {
      enableBiometric: false,
    });
  });

  it("should show the recovery key the change just minted", async () => {
    // The endpoint spends the old one, so dropping this would leave the user
    // holding a key that opens nothing.
    await changeVaultPin("1234", "4321");

    expect(useVaultStore.getState().pendingRecoveryNotice).toEqual({
      kind: "minted",
      recoveryKey: "EEEE-FFFF",
    });
  });

  it("should leave biometrics alone when none was armed", async () => {
    mocked.hasBiometricKey.mockResolvedValue(false);

    await changeVaultPin("1234", "4321");

    expect(mocked.disableBiometricUnlock).not.toHaveBeenCalled();
    expect(mocked.enableBiometricUnlock).not.toHaveBeenCalled();
  });

  it("should re-arm biometrics from the new key", async () => {
    mocked.hasBiometricKey.mockResolvedValue(true);
    mocked.enableBiometricUnlock.mockResolvedValue(true);

    await changeVaultPin("1234", "4321");

    expect(mocked.disableBiometricUnlock).toHaveBeenCalled();
    expect(useVaultStore.getState().isBiometricAvailable).toBe(true);
  });

  it("should stop offering biometrics when re-arming fails", async () => {
    // Otherwise the unlock screen keeps a button whose slot no longer holds a
    // key the vault would accept.
    useVaultStore.setState({ isBiometricAvailable: true });
    mocked.hasBiometricKey.mockResolvedValue(true);
    mocked.enableBiometricUnlock.mockResolvedValue(false);

    await changeVaultPin("1234", "4321");

    expect(useVaultStore.getState().isBiometricAvailable).toBe(false);
  });
});
