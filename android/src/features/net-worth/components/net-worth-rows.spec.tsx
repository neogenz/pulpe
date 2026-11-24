import { render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";

import { contractAssets } from "@/core/testing/net-worth-accounts";

import { AssetGroupCard } from "./asset-group-card";

jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({
    locale: "fr",
    t: (key: string, options?: Record<string, unknown>) =>
      jest
        .requireActual("@/core/i18n/i18n")
        .translateForLocale("fr", key, options),
  }),
}));
jest.mock("@/core/ui/ripple", () => ({ useRipple: () => ({}) }));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const NOW = new Date("2026-11-24T12:00:00.000Z");
const actions = {
  edit: jest.fn(),
  toggleArchive: jest.fn(),
  remove: jest.fn(),
  toggleDefault: jest.fn(),
};

function card(overrides: Parameters<typeof contractAssets>[0] = []) {
  const assets = contractAssets(overrides);
  return render(
    <PaperProvider>
      <AssetGroupCard
        group={{
          id: "own",
          name: "Comptes",
          total: 15_400,
          assets: assets.slice(0, 3),
          isType: true,
        }}
        baseCurrency="CHF"
        actions={actions}
        defaultAccountId={null}
      />
    </PaperProvider>,
  );
}

describe("what moved since my last entry (PUL-377)", () => {
  beforeEach(() => jest.useFakeTimers({ now: NOW, advanceTimers: true }));
  afterEach(() => jest.useRealTimers());

  const livretMoved = {
    recordedValue: 10_000,
    latestValue: 10_500,
    latestRecordedAt: "2026-11-24T08:00:00.000Z",
  };

  it("CA9 says +500.00 CHF since the entry of the day, signed", async () => {
    const view = await card([{}, {}, livretMoved]);

    expect(
      view.getByText("+500.00 CHF depuis ta saisie du 24 novembre"),
    ).toBeTruthy();
  });

  it("CA9 keeps the age when nothing was checked since the entry", async () => {
    const view = await card([
      {},
      {},
      { latestRecordedAt: "2026-11-24T08:00:00.000Z" },
    ]);

    expect(view.getByText("Mis à jour aujourd'hui")).toBeTruthy();
    expect(view.queryByText(/depuis ta saisie/)).toBeNull();
  });

  it("CA8 offers no proposal to apply or dismiss", async () => {
    const view = await card([
      {},
      {},
      {
        ...livretMoved,
        suggestion: { delta: 500, proposedValue: 10_500 },
      },
    ]);

    expect(view.queryByText(/Je propose|Appliquer|Écarter/)).toBeNull();
  });
});
