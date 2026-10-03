import {
  beginPasswordRecovery,
  clearRecoveryPending,
  isRecoveryPending,
  parseRecoveryTokens,
} from "./password-recovery";
import { isAcceptablePassword } from "./password-rules";

const mockSetSession = jest.fn();
const mockGetPersistedSessionSnapshot = jest.fn();

jest.mock("./supabase", () => ({
  getPersistedSessionSnapshot: () => mockGetPersistedSessionSnapshot(),
  supabase: {
    auth: { setSession: (...args: unknown[]) => mockSetSession(...args) },
  },
}));

const RECOVERY_LINK =
  "https://app.pulpe.app/reset-password#access_token=access-1&refresh_token=refresh-1&expires_in=3600&token_type=bearer&type=recovery";

describe("parseRecoveryTokens", () => {
  it("reads both tokens out of the fragment", () => {
    expect(parseRecoveryTokens(RECOVERY_LINK)).toEqual({
      accessToken: "access-1",
      refreshToken: "refresh-1",
    });
  });

  it("rejects an expired link, which carries an error instead of tokens", () => {
    const expired =
      "https://app.pulpe.app/reset-password#error=access_denied&error_code=otp_expired";

    expect(parseRecoveryTokens(expired)).toBeNull();
  });

  it("rejects a link with no fragment at all", () => {
    expect(parseRecoveryTokens("https://app.pulpe.app/reset-password")).toBe(
      null,
    );
  });

  // A magic-link or signup confirmation lands on the same address; only a
  // recovery link may open the change-password screen.
  it("rejects a fragment whose type is not recovery", () => {
    const magicLink = RECOVERY_LINK.replace("type=recovery", "type=magiclink");

    expect(parseRecoveryTokens(magicLink)).toBeNull();
  });

  it("rejects a fragment missing the refresh token", () => {
    const partial = RECOVERY_LINK.replace("refresh_token=refresh-1&", "");

    expect(parseRecoveryTokens(partial)).toBeNull();
  });
});

describe("isAcceptablePassword", () => {
  it.each([
    ["motdepasse1", true],
    ["Motdepasse2026", true],
    ["court1a", false],
    ["motdepasse", false],
    ["12345678", false],
  ])("scores %s as %s", (password, expected) => {
    expect(isAcceptablePassword(password)).toBe(expected);
  });
});

describe("a recovery in progress", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearRecoveryPending();
    mockGetPersistedSessionSnapshot.mockReset().mockResolvedValue(null);
  });

  afterEach(() => clearRecoveryPending());

  it("is marked before its session exists, so a killed process cannot resume it", async () => {
    mockSetSession.mockImplementationOnce(async () => {
      expect(isRecoveryPending()).toBe(true);
      return { error: null };
    });

    await beginPasswordRecovery({ accessToken: "a", refreshToken: "r" });

    expect(mockSetSession).toHaveBeenCalledTimes(1);
    expect(isRecoveryPending()).toBe(true);
    clearRecoveryPending();
    expect(isRecoveryPending()).toBe(false);
  });

  it.each(["returned", "thrown"])(
    "clears a refused recovery when its error is %s",
    async (outcome) => {
      const error = new Error("Invalid refresh token");
      if (outcome === "returned") {
        mockSetSession.mockResolvedValueOnce({ error });
      } else {
        mockSetSession.mockRejectedValueOnce(error);
      }

      await expect(
        beginPasswordRecovery({ accessToken: "a", refreshToken: "r" }),
      ).rejects.toBe(error);

      expect(isRecoveryPending()).toBe(false);
    },
  );

  it("keeps the guard if a session was persisted before setup failed", async () => {
    const error = new Error("Auth listener failed");
    mockSetSession.mockRejectedValueOnce(error);
    mockGetPersistedSessionSnapshot
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("recovery-session");

    await expect(
      beginPasswordRecovery({ accessToken: "a", refreshToken: "r" }),
    ).rejects.toBe(error);

    expect(isRecoveryPending()).toBe(true);
  });

  it("keeps the guard and original error when persistence cannot be read", async () => {
    const error = new Error("Recovery failed");
    mockSetSession.mockRejectedValueOnce(error);
    mockGetPersistedSessionSnapshot
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("Secure storage unavailable"));

    await expect(
      beginPasswordRecovery({ accessToken: "a", refreshToken: "r" }),
    ).rejects.toBe(error);

    expect(isRecoveryPending()).toBe(true);
  });

  it.each(["returned", "thrown"])(
    "does not mark an older ordinary session when recovery fails with a %s error",
    async (outcome) => {
      const error = new Error("Invalid refresh token");
      if (outcome === "returned") {
        mockSetSession.mockResolvedValueOnce({ error });
      } else {
        mockSetSession.mockRejectedValueOnce(error);
      }
      mockGetPersistedSessionSnapshot.mockResolvedValue("ordinary-session");

      await expect(
        beginPasswordRecovery({ accessToken: "a", refreshToken: "r" }),
      ).rejects.toBe(error);

      expect(isRecoveryPending()).toBe(false);
    },
  );

  it("clears an auth rejection without rereading persistence", async () => {
    const error = new Error("Invalid refresh token");
    mockSetSession.mockResolvedValueOnce({ error });
    mockGetPersistedSessionSnapshot
      .mockResolvedValueOnce("ordinary-session")
      .mockRejectedValueOnce(new Error("Secure storage unavailable"));

    await expect(
      beginPasswordRecovery({ accessToken: "a", refreshToken: "r" }),
    ).rejects.toBe(error);

    expect(mockGetPersistedSessionSnapshot).toHaveBeenCalledTimes(1);
    expect(isRecoveryPending()).toBe(false);
  });

  it("does not arm recovery when the initial snapshot cannot be read", async () => {
    const error = new Error("Secure storage unavailable");
    mockGetPersistedSessionSnapshot.mockRejectedValueOnce(error);

    await expect(
      beginPasswordRecovery({ accessToken: "a", refreshToken: "r" }),
    ).rejects.toBe(error);

    expect(mockSetSession).not.toHaveBeenCalled();
    expect(isRecoveryPending()).toBe(false);
  });

  it("preserves an earlier interrupted recovery if another link is refused", async () => {
    mockSetSession.mockResolvedValueOnce({ error: null });
    await beginPasswordRecovery({ accessToken: "a", refreshToken: "r" });
    const error = new Error("Invalid refresh token");
    mockSetSession.mockResolvedValueOnce({ error });

    await expect(
      beginPasswordRecovery({ accessToken: "b", refreshToken: "s" }),
    ).rejects.toBe(error);

    expect(isRecoveryPending()).toBe(true);
  });
});
