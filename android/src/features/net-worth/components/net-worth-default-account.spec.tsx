import { fireEvent, render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";

import {
  COMPTE_COURANT,
  contractAssets,
  LIVRET,
  REVOLUT,
} from "@/core/testing/net-worth-accounts";

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

// Paper's Menu measures its anchor before it shows anything, which jest never
// answers reliably: the entries are what these tests are about.
jest.mock("react-native-paper", () => {
  const paper = jest.requireActual("react-native-paper");
  const { View } = jest.requireActual("react-native");
  const Menu = Object.assign(
    ({
      visible,
      anchor,
      children,
    }: {
      visible: boolean;
      anchor: React.ReactNode;
      children: React.ReactNode;
    }) => (
      <View>
        {anchor}
        {visible ? children : null}
      </View>
    ),
    { Item: paper.Menu.Item },
  );
  return { ...paper, Menu };
});

const actions = {
  edit: jest.fn(),
  toggleArchive: jest.fn(),
  remove: jest.fn(),
  toggleDefault: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

function card(
  overrides: Parameters<typeof contractAssets>[0] = [],
  defaultAccountId: string | null = null,
) {
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
        defaultAccountId={defaultAccountId}
      />
    </PaperProvider>,
  );
}

describe("default account in the row (PUL-378)", () => {
  it("CA47 offers « Ne plus utiliser par défaut » on the default one", async () => {
    const view = await card([], LIVRET);
    await fireEvent.press(view.getByLabelText("Actions pour Livret"));

    expect(view.getByText("Ne plus utiliser par défaut")).toBeTruthy();
    expect(view.queryByText("Utiliser par défaut dans le budget")).toBeNull();
  });

  it("CA47 offers « Utiliser par défaut dans le budget » on another element", async () => {
    const view = await card([], COMPTE_COURANT);
    await fireEvent.press(view.getByLabelText("Actions pour Revolut"));
    await fireEvent.press(view.getByText("Utiliser par défaut dans le budget"));

    expect(actions.toggleDefault).toHaveBeenCalledWith(
      expect.objectContaining({ id: REVOLUT }),
    );
  });

  it("CA35 neither badges nor offers the entry on an archived element", async () => {
    const view = await card(
      [{ archivedAt: "2026-11-02T00:00:00.000Z" }],
      COMPTE_COURANT,
    );
    await fireEvent.press(view.getByLabelText("Actions pour Compte courant"));

    expect(view.queryByText("Par défaut")).toBeNull();
    expect(view.queryByText("Ne plus utiliser par défaut")).toBeNull();
    expect(view.queryByText("Utiliser par défaut dans le budget")).toBeNull();
  });

  it("CA47 badges the default account and no other", async () => {
    const view = await card([], COMPTE_COURANT);

    expect(view.getAllByText("Par défaut")).toHaveLength(1);
  });
});
