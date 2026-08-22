import { api } from "@/core/api/api";
import { ApiError } from "@/core/api/api-error";

import { checkSystemGate, useSystemStore } from "./system-store";

jest.mock("@/core/api/api", () => ({ api: { get: jest.fn() } }));
jest.mock("expo-constants", () => ({ expoConfig: { version: "1.2.0" } }));

const mockedGet = jest.mocked(api.get);

function versionResponse(minVersion: string) {
  const platform = { minVersion, latestVersion: minVersion };
  return {
    success: true as const,
    data: {
      android: { ...platform, storeUrl: "https://play.google.com/pulpe" },
      ios: platform,
      web: platform,
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useSystemStore.setState({ gate: "ok", storeUrl: null, isChecking: false });
});

describe("checkSystemGate", () => {
  it("should raise the update gate below the published minimum", async () => {
    mockedGet.mockResolvedValue(versionResponse("1.10.0"));

    await checkSystemGate();

    expect(useSystemStore.getState()).toMatchObject({
      gate: "forceUpdate",
      storeUrl: "https://play.google.com/pulpe",
    });
    expect(mockedGet).toHaveBeenCalledWith(
      expect.any(String),
      expect.anything(),
      undefined,
      { timeoutMs: 3000, retryCount: 0 },
    );
  });

  it("should let the app through at the published minimum", async () => {
    mockedGet.mockResolvedValue(versionResponse("1.2.0"));

    await checkSystemGate();

    expect(useSystemStore.getState().gate).toBe("ok");
  });

  it("should leave maintenance after a healthy compatible retry", async () => {
    mockedGet
      .mockRejectedValueOnce(
        new ApiError("En maintenance", "MAINTENANCE", 503, undefined),
      )
      .mockResolvedValueOnce(versionResponse("1.2.0"));

    await checkSystemGate();
    expect(useSystemStore.getState().gate).toBe("maintenance");

    await checkSystemGate();
    expect(useSystemStore.getState().gate).toBe("ok");
  });

  it("should fail open when no server answers on launch", async () => {
    mockedGet.mockRejectedValue(
      new ApiError("Connexion impossible", "NETWORK_ERROR", 0, undefined),
    );

    await checkSystemGate();

    expect(useSystemStore.getState().gate).toBe("ok");
  });

  it("should keep a raised gate when a later check fails", async () => {
    // Otherwise airplane mode would be enough to walk past a forced update.
    useSystemStore.setState({ gate: "forceUpdate" });
    mockedGet.mockRejectedValue(
      new ApiError("Connexion impossible", "NETWORK_ERROR", 0, undefined),
    );

    await checkSystemGate();

    expect(useSystemStore.getState().gate).toBe("forceUpdate");
  });

  it("should keep a confirmed gate when a later response would allow access", async () => {
    useSystemStore.setState({ gate: "forceUpdate" });
    mockedGet.mockResolvedValue(versionResponse("1.0.0"));

    await checkSystemGate();

    expect(useSystemStore.getState().gate).toBe("forceUpdate");
  });

  it("should share concurrent checks", async () => {
    let resolve!: (value: ReturnType<typeof versionResponse>) => void;
    mockedGet.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );

    const first = checkSystemGate();
    const second = checkSystemGate();
    expect(first).toBe(second);
    expect(mockedGet).toHaveBeenCalledTimes(1);
    resolve(versionResponse("1.2.0"));
    await Promise.all([first, second]);

    expect(useSystemStore.getState()).toMatchObject({
      gate: "ok",
      isChecking: false,
    });
  });
});
