import type { AppEnvironment } from "@/core/config/env";

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
const FIVE_MINUTES = 5 * 60_000;

/**
 * `ENV` is read once at import, so each case loads the module fresh with the
 * variables it wants to see — the real `env.ts` included, since the override
 * policy lives there.
 */
function loadAutoLock(
  environment: AppEnvironment,
  override?: string,
): typeof import("./auto-lock") {
  process.env.EXPO_PUBLIC_APP_ENV = environment;
  process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.example.test";
  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  if (override === undefined) delete process.env.EXPO_PUBLIC_AUTO_LOCK_DELAY_MS;
  else process.env.EXPO_PUBLIC_AUTO_LOCK_DELAY_MS = override;

  let loaded: typeof import("./auto-lock") | undefined;
  jest.isolateModules(() => {
    loaded = jest.requireActual<typeof import("./auto-lock")>("./auto-lock");
  });
  return loaded!;
}

const { AUTO_LOCK_DELAY_MS, shouldLockOnResume } = loadAutoLock("local");

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

describe("the delay", () => {
  it("is five minutes when nothing says otherwise", () => {
    expect(AUTO_LOCK_DELAY_MS).toBe(FIVE_MINUTES);
    expect(loadAutoLock("local").AUTO_LOCK_DELAY_MINUTES).toBe(5);
  });

  it("follows the override on a preview build, so CI can script a return", () => {
    const preview = loadAutoLock("preview", "10000");

    expect(preview.AUTO_LOCK_DELAY_MS).toBe(10_000);
    expect(preview.shouldLockOnResume(NOW - 10_000, NOW)).toBe(true);
  });

  it("ignores the override on a production build", () => {
    expect(loadAutoLock("production", "10000").AUTO_LOCK_DELAY_MS).toBe(
      FIVE_MINUTES,
    );
  });

  it("refuses a value that is not a positive integer", () => {
    expect(() => loadAutoLock("preview", "soon")).toThrow(
      "EXPO_PUBLIC_AUTO_LOCK_DELAY_MS",
    );
    expect(() => loadAutoLock("preview", "0")).toThrow(
      "EXPO_PUBLIC_AUTO_LOCK_DELAY_MS",
    );
  });
});
