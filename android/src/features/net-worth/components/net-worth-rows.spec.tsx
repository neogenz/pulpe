import { fireEvent, render, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { PaperProvider } from "react-native-paper";

import { contractAssets } from "@/core/testing/net-worth-accounts";

import { AssetGroupCard, AssetRows } from "./asset-group-card";

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
let mockFontScale = 1;
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({
    width: 411,
    height: 891,
    scale: 1,
    fontScale: mockFontScale,
  }),
}));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const NOW = new Date("2026-11-24T12:00:00.000Z");
const actions = {
  open: jest.fn(),
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

describe("a row opens the element's detail (PUL-379)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("CA1 opens the detail on a tap, and says so to TalkBack", async () => {
    const view = await card();
    const row = view.getByRole("button", { name: /^Compte courant, / });

    expect(row.props.accessibilityHint).toBe(
      "Ouvre le détail de Compte courant",
    );
    await fireEvent.press(row);

    expect(actions.open).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Compte courant" }),
    );
    expect(actions.edit).not.toHaveBeenCalled();
  });

  it("CA15 leaves an archived row inert", async () => {
    const [, , livret] = contractAssets();
    const view = await render(
      <PaperProvider>
        <AssetRows
          assets={[{ ...livret, archivedAt: "2026-11-20T10:00:00.000Z" }]}
          baseCurrency="CHF"
          actions={actions}
          defaultAccountId={null}
        />
      </PaperProvider>,
    );

    expect(view.getByLabelText(/^Livret, /)).toBeTruthy();
    expect(view.queryByRole("button", { name: /^Livret, / })).toBeNull();
  });
});

describe("a row at large text", () => {
  afterEach(() => {
    mockFontScale = 1;
  });

  it.each([1, 1.5, 2])(
    "puts the value under the whole name from the accessible scale (scale: %s)",
    async (fontScale) => {
      mockFontScale = fontScale;
      const view = await card();
      const name = view.getByText("Compte courant");
      const value = view.getByText(/^5.000\.00 CHF$/);
      const stacked = fontScale >= 1.5;

      expect(name.props.numberOfLines).toBe(stacked ? undefined : 2);
      expect(value.props.numberOfLines).toBe(1);
      // The nearest view holding both: a row side by side, a column stacked.
      let line = value.parent;
      while (line !== null && !within(line).queryByText("Compte courant")) {
        line = line.parent;
      }
      expect(StyleSheet.flatten(line?.props.style)?.flexDirection).toBe(
        stacked ? undefined : "row",
      );
    },
  );
});
