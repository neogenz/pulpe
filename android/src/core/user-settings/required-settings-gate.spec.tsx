import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

import { RequiredSettingsGate } from "./required-settings-gate";
import { useUserSettings } from "./user-settings-queries";

jest.mock("./user-settings-queries", () => ({ useUserSettings: jest.fn() }));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockedUseSettings = jest.mocked(useUserSettings);
const refetch = jest.fn();

function settings(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isError: false, refetch, ...overrides } as never;
}

const renderGate = () =>
  render(
    <RequiredSettingsGate>
      <Text>main-content</Text>
    </RequiredSettingsGate>,
  );

describe("RequiredSettingsGate", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders cached settings even when a background refresh failed", async () => {
    mockedUseSettings.mockReturnValue(settings({ data: {}, isError: true }));

    const view = await renderGate();

    expect(view.getByText("main-content")).toBeTruthy();
  });

  it("shows a retryable error when no settings are available", async () => {
    mockedUseSettings.mockReturnValue(settings({ isError: true }));

    const view = await renderGate();
    await fireEvent.press(view.getByText("common.retry"));

    expect(view.getByText("system.requiredSettings.title")).toBeTruthy();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("announces loading while settings are pending", async () => {
    mockedUseSettings.mockReturnValue(settings());

    const view = await renderGate();

    expect(view.getByLabelText("system.requiredSettings.loading")).toBeTruthy();
  });
});
