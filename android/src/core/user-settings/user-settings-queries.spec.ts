import type { UserSettings } from "pulpe-shared";

import { queryClient } from "@/core/query/query-client";

import { cacheUserSettings, userSettingsKeys } from "./user-settings-queries";

jest.mock("@/core/query/query-client", () => ({
  queryClient: {
    setQueryData: jest.fn(),
    invalidateQueries: jest.fn(),
  },
}));
jest.mock("@/core/vault/vault-store", () => ({ useVaultStore: jest.fn() }));
jest.mock("./user-settings-api", () => ({ fetchUserSettings: jest.fn() }));

describe("cacheUserSettings", () => {
  it("updates settings without refetching unrelated queries", () => {
    const settings = { locale: "de" } as UserSettings;

    cacheUserSettings(settings);

    expect(queryClient.setQueryData).toHaveBeenCalledWith(
      userSettingsKeys.all,
      settings,
    );
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });
});
