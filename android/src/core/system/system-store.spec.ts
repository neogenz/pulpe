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
  });

  it("should let the app through at the published minimum", async () => {
    mockedGet.mockResolvedValue(versionResponse("1.2.0"));

    await checkSystemGate();

    expect(useSystemStore.getState().gate).toBe("ok");
  });

  it("should show maintenance when the server says it is down", async () => {
    mockedGet.mockRejectedValue(
      new ApiError("En maintenance", "MAINTENANCE", 503, undefined),
    );

    await checkSystemGate();

    expect(useSystemStore.getState().gate).toBe("maintenance");
  });

  it("should report being offline when no server answers", async () => {
    mockedGet.mockRejectedValue(
      new ApiError("Connexion impossible", "NETWORK_ERROR", 0, undefined),
    );

    await checkSystemGate();

    expect(useSystemStore.getState().gate).toBe("offline");
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

  it("should leave the gate alone when the check outlives its budget", async () => {
    jest.useFakeTimers();
    mockedGet.mockReturnValue(new Promise(() => undefined));

    const check = checkSystemGate();
    jest.runOnlyPendingTimers();
    await check;

    expect(useSystemStore.getState()).toMatchObject({
      gate: "ok",
      isChecking: false,
    });
    jest.useRealTimers();
  });
});
