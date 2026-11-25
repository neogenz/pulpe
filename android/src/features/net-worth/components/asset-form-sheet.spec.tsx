import { render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";

import { contractAssets } from "@/core/testing/net-worth-accounts";

import { AssetFormSheet } from "./asset-form-sheet";

const mockMutation = { mutateAsync: jest.fn(), mutate: jest.fn() };
jest.mock("../net-worth-queries", () => ({
  useCreateAsset: () => mockMutation,
  useUpdateAsset: () => mockMutation,
  useRecordAssetSnapshots: () => mockMutation,
  useCreateAssetCategory: () => mockMutation,
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({
    locale: "fr",
    t: (key: string, options?: Record<string, unknown>) =>
      jest
        .requireActual("@/core/i18n/i18n")
        .translateForLocale("fr", key, options),
  }),
}));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

function edit(overrides: Parameters<typeof contractAssets>[0]) {
  const [asset] = contractAssets(overrides);
  return render(
    <PaperProvider>
      <AssetFormSheet
        asset={asset}
        netWorth={undefined}
        baseCurrency="CHF"
        onDismiss={jest.fn()}
        onToggleArchive={jest.fn()}
        onDelete={jest.fn()}
      />
    </PaperProvider>,
  );
}

describe("editing an element after checked lines moved it (PUL-377 CA10)", () => {
  const moved = {
    recordedValue: 5000,
    latestValue: 4920,
    latestRecordedAt: "2020-11-03T10:00:00.000Z",
  };

  it("reminds my last entry, not the value today", async () => {
    const view = await edit([moved]);

    expect(
      view.getByText(
        "Ta dernière saisie : 5’000.00 CHF, le 3\u00a0novembre\u00a02020",
      ),
    ).toBeTruthy();
  });

  it("keeps the entry's sign when it was an overdraft", async () => {
    const view = await edit([
      {
        recordedValue: -250,
        latestValue: 100,
        latestRecordedAt: moved.latestRecordedAt,
      },
    ]);

    expect(
      view.getByText("Ta dernière saisie : −250.00 CHF, le 3 novembre 2020"),
    ).toBeTruthy();
  });
});
