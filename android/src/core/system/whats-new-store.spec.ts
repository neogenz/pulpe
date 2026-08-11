import { api } from "@/core/api/api";

import {
  acknowledgeWhatsNew,
  checkWhatsNew,
  useWhatsNewStore,
} from "./whats-new-store";

const mockStorage = new Map<string, string>();

// A local mock, not the shared one from `jest.setup.js`: these tests are about
// what the marker holds, so they have to be able to write it.
jest.mock("react-native-mmkv", () => ({
  createMMKV: () => ({
    set: (key: string, value: string) => mockStorage.set(key, value),
    getString: (key: string) => mockStorage.get(key),
  }),
}));
jest.mock("@/core/api/api", () => ({ api: { get: jest.fn() } }));
jest.mock("expo-constants", () => ({ expoConfig: { version: "1.2.0" } }));

const LAST_SEEN_KEY = "pulpe-whats-new-last-seen";
const mockedGet = api.get as jest.MockedFunction<typeof api.get>;

const ENTRY = {
  version: "1.2.0",
  title: "Nouveautés de la version 1.2.0",
  body: "- **Lissage** — étale une dépense sur plusieurs mois",
  publishedAt: "2026-08-01",
};

function answerWith(entries: unknown[]) {
  mockedGet.mockResolvedValue({ success: true, data: { entries } } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStorage.clear();
  useWhatsNewStore.setState({ entries: [] });
});

describe("checkWhatsNew", () => {
  it("should say nothing on a fresh install", async () => {
    await checkWhatsNew();

    // "Everything is new" is not news — record where we are and stay quiet.
    expect(mockedGet).not.toHaveBeenCalled();
    expect(mockStorage.get(LAST_SEEN_KEY)).toBe("1.2.0");
  });

  it("should ask for the notes between the last seen version and this one", async () => {
    mockStorage.set(LAST_SEEN_KEY, "1.1.0");
    answerWith([ENTRY]);

    await checkWhatsNew();

    expect(mockedGet).toHaveBeenCalledWith(
      "/whats-new/android",
      expect.anything(),
      { currentVersion: "1.2.0", lastSeenVersion: "1.1.0" },
    );
    expect(useWhatsNewStore.getState().entries).toEqual([ENTRY]);
  });

  it("should not ask twice for a version already seen", async () => {
    mockStorage.set(LAST_SEEN_KEY, "1.2.0");

    await checkWhatsNew();

    expect(mockedGet).not.toHaveBeenCalled();
  });

  it("should not treat a downgrade as an upgrade", async () => {
    // A debug build installed over a release one.
    mockStorage.set(LAST_SEEN_KEY, "1.3.0");

    await checkWhatsNew();

    expect(mockedGet).not.toHaveBeenCalled();
  });

  it("should move the marker when a release had nothing user-facing to say", async () => {
    mockStorage.set(LAST_SEEN_KEY, "1.1.0");
    answerWith([]);

    await checkWhatsNew();

    expect(useWhatsNewStore.getState().entries).toEqual([]);
    // Moved, or the empty answer is re-fetched on every single launch.
    expect(mockStorage.get(LAST_SEEN_KEY)).toBe("1.2.0");
  });

  it("should leave the marker alone when the feed fails", async () => {
    mockStorage.set(LAST_SEEN_KEY, "1.1.0");
    mockedGet.mockRejectedValue(new Error("offline"));

    await checkWhatsNew();

    // Fails open and retries next launch, rather than eating the notes.
    expect(useWhatsNewStore.getState().entries).toEqual([]);
    expect(mockStorage.get(LAST_SEEN_KEY)).toBe("1.1.0");
  });

  it("should record the version only once the user has acknowledged it", () => {
    mockStorage.set(LAST_SEEN_KEY, "1.1.0");
    useWhatsNewStore.setState({ entries: [ENTRY] });

    acknowledgeWhatsNew();

    expect(mockStorage.get(LAST_SEEN_KEY)).toBe("1.2.0");
    expect(useWhatsNewStore.getState().entries).toEqual([]);
  });
});
