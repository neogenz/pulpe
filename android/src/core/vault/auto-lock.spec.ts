import { AUTO_LOCK_DELAY_MS, shouldLockOnResume } from "./auto-lock";

/**
 * The store is mocked away rather than exercised: importing it for real reaches
 * `pbkdf2.ts`, which binds to a native module Jest has no business booting —
 * the same reason `vault-store.spec.ts` hand-writes its factories. What is
 * under test here is the delay policy, which touches neither.
 */
jest.mock("./vault-store", () => ({
  lockVault: jest.fn(),
  useVaultStore: { getState: jest.fn() },
}));

const NOW = 1_770_000_000_000;

describe("shouldLockOnResume", () => {
  it("leaves a launch alone: the first foreground is not a return", () => {
    expect(shouldLockOnResume(null, NOW)).toBe(false);
  });

  it("keeps the vault open across the trips a flow makes on its own", () => {
    // A Google sign-in, a date picker, a notification pulled down.
    const away = 20_000;

    expect(shouldLockOnResume(NOW - away, NOW)).toBe(false);
  });

  it("closes the vault once the app has been away long enough", () => {
    expect(shouldLockOnResume(NOW - AUTO_LOCK_DELAY_MS, NOW)).toBe(true);
    expect(shouldLockOnResume(NOW - AUTO_LOCK_DELAY_MS - 1, NOW)).toBe(true);
  });

  it("holds the boundary itself open one millisecond short", () => {
    expect(shouldLockOnResume(NOW - AUTO_LOCK_DELAY_MS + 1, NOW)).toBe(false);
  });

  it("does not lock on a clock that has moved backwards", () => {
    // An NTP correction mid-background would otherwise read as a negative stay.
    expect(shouldLockOnResume(NOW + 60_000, NOW)).toBe(false);
  });
});
