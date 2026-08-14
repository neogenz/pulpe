import { ApiError } from "@/core/api/api-error";
import { queryClient } from "@/core/query/query-client";

import {
  isVaultKeyRejected,
  observeVaultKeyRejection,
} from "./key-invalidation";
import { lockVault, useVaultStore, type VaultStatus } from "./vault-store";

jest.mock("./vault-store", () => ({
  lockVault: jest.fn(),
  useVaultStore: { getState: jest.fn() },
}));

function vaultState(status: VaultStatus) {
  return {
    status,
    isBiometricAvailable: false,
    bootstrapError: null,
    pendingRecoveryNotice: null,
  };
}

const mockedLockVault = jest.mocked(lockVault);
const mockedGetState = jest.mocked(useVaultStore.getState);

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;

function apiError(code: string, status = HTTP_BAD_REQUEST): ApiError {
  return new ApiError("refusé", code, status, undefined);
}

describe("isVaultKeyRejected", () => {
  // The one a PIN changed elsewhere produces: well-formed key, wrong vault.
  it("recognises a key that no longer opens the vault", () => {
    expect(
      isVaultKeyRejected(apiError("ERR_ENCRYPTION_KEY_CHECK_FAILED")),
    ).toBe(true);
  });

  it("recognises a header the guard refused", () => {
    expect(isVaultKeyRejected(apiError("ERR_AUTH_CLIENT_KEY_MISSING"))).toBe(
      true,
    );
    expect(isVaultKeyRejected(apiError("ERR_AUTH_CLIENT_KEY_INVALID"))).toBe(
      true,
    );
  });

  it("leaves an ordinary failure alone", () => {
    expect(
      isVaultKeyRejected(apiError("ERR_BUDGET_NOT_FOUND", HTTP_NOT_FOUND)),
    ).toBe(false);
    expect(isVaultKeyRejected(new Error("offline"))).toBe(false);
  });
});

describe("observeVaultKeyRejection", () => {
  let stopObserving: () => void;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetState.mockReturnValue(vaultState("unlocked"));
    queryClient.clear();
    stopObserving = observeVaultKeyRejection();
  });

  afterEach(() => {
    stopObserving();
    // Each cached query arms a garbage-collection timer, and jest waits for
    // every one of them before it will exit.
    queryClient.clear();
  });

  async function failQuery(error: unknown): Promise<void> {
    await queryClient
      .fetchQuery({
        queryKey: ["probe", Math.random()],
        queryFn: () => Promise.reject(error),
        retry: false,
        gcTime: 0,
      })
      .catch(() => undefined);
  }

  it("relocks on the first read the key cannot open", async () => {
    await failQuery(apiError("ERR_ENCRYPTION_KEY_CHECK_FAILED"));

    expect(mockedLockVault).toHaveBeenCalledTimes(1);
  });

  it("leaves the vault open on any other failure", async () => {
    await failQuery(apiError("ERR_BUDGET_NOT_FOUND", HTTP_NOT_FOUND));

    expect(mockedLockVault).not.toHaveBeenCalled();
  });

  // The unlock attempt answers with this very code on a wrong PIN, and the
  // screen it would relock to is already the one on display.
  it("stays out of the way while the vault is locked", async () => {
    mockedGetState.mockReturnValue(vaultState("locked"));

    await failQuery(apiError("ERR_ENCRYPTION_KEY_CHECK_FAILED"));

    expect(mockedLockVault).not.toHaveBeenCalled();
  });

  it("stops watching once torn down", async () => {
    stopObserving();

    await failQuery(apiError("ERR_ENCRYPTION_KEY_CHECK_FAILED"));

    expect(mockedLockVault).not.toHaveBeenCalled();
    stopObserving = () => undefined;
  });
});
