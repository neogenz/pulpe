import { chunkedSecureStore } from "./chunked-secure-store";

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

/** Above the 2048-byte ceiling SecureStore warns about on Android. */
const LARGE_SESSION = "s".repeat(5000);

describe("chunkedSecureStore", () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it("should round-trip a value larger than the SecureStore ceiling", async () => {
    await chunkedSecureStore.setItem("session", LARGE_SESSION);

    expect(await chunkedSecureStore.getItem("session")).toBe(LARGE_SESSION);
  });

  it("should keep every stored chunk under the SecureStore ceiling", async () => {
    await chunkedSecureStore.setItem("session", LARGE_SESSION);

    const chunkSizes = [...mockStore.entries()]
      .filter(([key]) => key.startsWith("session."))
      .map(([, value]) => value.length);
    expect(chunkSizes.length).toBeGreaterThan(1);
    expect(Math.max(...chunkSizes)).toBeLessThanOrEqual(2048);
  });

  it("should return null for a key that was never written", async () => {
    expect(await chunkedSecureStore.getItem("session")).toBeNull();
  });

  it("should drop chunks left over by a shorter rewrite", async () => {
    await chunkedSecureStore.setItem("session", LARGE_SESSION);

    await chunkedSecureStore.setItem("session", "short");

    expect(await chunkedSecureStore.getItem("session")).toBe("short");
    expect(mockStore.has("session.1")).toBe(false);
  });

  it("should report a partially written value as absent", async () => {
    await chunkedSecureStore.setItem("session", LARGE_SESSION);

    mockStore.delete("session.1");

    expect(await chunkedSecureStore.getItem("session")).toBeNull();
  });

  it("should remove the header and every chunk on sign-out", async () => {
    await chunkedSecureStore.setItem("session", LARGE_SESSION);

    await chunkedSecureStore.removeItem("session");

    expect(mockStore.size).toBe(0);
  });
});
