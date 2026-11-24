import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import type { Asset, AssetHistory, AssetHistoryEntry } from "pulpe-shared";
import { PaperProvider } from "react-native-paper";

import AssetDetailScreen from "@/app/(main)/(tabs)/(net-worth)/asset/[id]";
import { api } from "@/core/api/api";
import { ApiError } from "@/core/api/api-error";
import { queryClient } from "@/core/query/query-client";
import { useAmountVisibility } from "@/core/ui/amount-visibility";
import {
  COMPTE_COURANT,
  contractAssets,
  LIVRET,
} from "@/core/testing/net-worth-accounts";
import { invalidateAfterBudgetWrite } from "@/features/budgets/budget-queries";

import { netWorthKeys } from "./net-worth-keys";

let mockFocus: () => void = () => undefined;
let mockAssetId = "";
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ id: mockAssetId }),
  useFocusEffect: (effect: () => void) => {
    const React = jest.requireActual("react");
    mockFocus = effect;
    React.useEffect(effect, [effect]);
  },
}));
jest.mock("@/core/api/api", () => ({ api: { get: jest.fn() } }));
jest.mock("@/core/vault/vault-store", () => ({
  useVaultStore: (select: (state: { status: string }) => unknown) =>
    select({ status: "unlocked" }),
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
jest.mock("@/core/ui/ripple", () => ({ useRipple: () => ({}) }));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  SafeAreaView: jest.requireActual("react-native").View,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("@/core/user-settings/user-settings-queries", () => ({
  invalidateUserSettings: jest.fn(),
}));
// The sheet is tested on its own; here it only says it opened, and on what.
jest.mock("@/features/net-worth/components/asset-form-sheet", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    AssetFormSheet: ({ asset }: { asset: Asset }) => (
      <Text>{`sheet:${asset.name}`}</Text>
    ),
  };
});

const NOW = new Date("2026-11-24T12:00:00.000Z");
const NBSP = " ";
const NOV_1 = "2026-11-01T10:00:00.000Z";

const id = (n: number) =>
  `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`;
const snapshot = (n: number, at: string, value: number): AssetHistoryEntry => ({
  type: "snapshot",
  id: id(n),
  at,
  value,
});
const movement = (
  n: number,
  name: string,
  at: string,
  effect: number | null,
  supersededAt: string | null = null,
): AssetHistoryEntry => ({
  type: "movement",
  id: id(n),
  at,
  name,
  effect,
  supersededAt,
});

/** The jeu d'essai of PUL-379, newest first. */
const SALAIRE = movement(1, "Salaire", "2026-11-10T09:00:00.000Z", 6000);
const RESTAURANT = movement(2, "Restaurant", "2026-11-05T09:00:00.000Z", -80);
const LOYER = movement(3, "Loyer", "2026-11-03T09:00:00.000Z", -1500);
const ENTRY_NOV = snapshot(4, NOV_1, 5000);
const ASSURANCE = movement(
  5,
  "Assurance",
  "2026-10-28T09:00:00.000Z",
  -300,
  NOV_1,
);
const ENTRY_OCT = snapshot(6, "2026-10-01T10:00:00.000Z", 4800);
const COMPTE_ENTRIES = [
  SALAIRE,
  RESTAURANT,
  LOYER,
  ENTRY_NOV,
  ASSURANCE,
  ENTRY_OCT,
];

const [compteCourant, , livret] = contractAssets([
  { latestValue: 9420, recordedValue: 5000, convertedValue: 9420 },
]);

let pages: Record<string, AssetHistory | ApiError>;

function page(
  asset: Asset,
  entries: AssetHistoryEntry[],
  nextCursor: string | null = null,
): AssetHistory {
  return { asset, entries, nextCursor };
}

async function open(assetId: string) {
  mockAssetId = assetId;
  await render(
    <QueryClientProvider client={queryClient}>
      <PaperProvider>
        <AssetDetailScreen />
      </PaperProvider>
    </QueryClientProvider>,
  );
}

const historyCalls = () =>
  jest.mocked(api.get).mock.calls.filter(([path]) => path.endsWith("/history"));

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, advanceTimers: true });
  queryClient.clear();
  jest.mocked(api.get).mockReset();
  jest.mocked(api.get).mockImplementation(async (path, _schema, query) => {
    if (path === "/assets") {
      return {
        data: {
          totals: {},
          categories: [{ id: compteCourant.categoryId, name: "Comptes" }],
          assets: [compteCourant, livret],
        },
      };
    }
    const assetId = path.split("/")[2];
    const result = pages[`${assetId}:${query?.cursor ?? ""}`];
    if (result instanceof ApiError) throw result;
    return { data: result };
  });
  pages = { [`${COMPTE_COURANT}:`]: page(compteCourant, COMPTE_ENTRIES) };
});
afterEach(() => jest.useRealTimers());

const rowTitles = () =>
  screen
    .getAllByText(
      /^(Salaire|Restaurant|Loyer|Assurance|Courses|Valeur enregistrée)$/,
    )
    .map((node) => node.props.children as string);

describe("the detail of an element (PUL-379)", () => {
  it("CA2 shows the name, the type, the value today and my last entry", async () => {
    await open(COMPTE_COURANT);

    expect(await screen.findByText("Compte courant")).toBeTruthy();
    expect(screen.getByLabelText("Comptes 9’420.00 CHF")).toBeTruthy();
    expect(
      screen.getByText(
        `Ta dernière saisie : 5’000.00 CHF, le 1er${NBSP}novembre`,
      ),
    ).toBeTruthy();
  });

  it("CA3 lists entries and movements in one list, newest first", async () => {
    await open(COMPTE_COURANT);
    await screen.findByText("Salaire");

    expect(rowTitles()).toEqual([
      "Salaire",
      "Restaurant",
      "Loyer",
      "Valeur enregistrée",
      "Assurance",
      "Valeur enregistrée",
    ]);
  });

  it("CA4 signs each movement's effect and shows each entry's value", async () => {
    await open(COMPTE_COURANT);
    await screen.findByText("Salaire");

    for (const amount of [
      "+6’000.00 CHF",
      "−80.00 CHF",
      "−1’500.00 CHF",
      "5’000.00 CHF",
      "−300.00 CHF",
      "4’800.00 CHF",
    ]) {
      expect(screen.getByText(amount)).toBeTruthy();
    }
  });

  it("CA6 says Assurance no longer counts, and only Assurance", async () => {
    await open(COMPTE_COURANT);
    await screen.findByText("Salaire");

    expect(
      screen.getAllByText(`Déjà compris dans ta saisie du 1er${NBSP}novembre`),
    ).toHaveLength(1);
  });

  it("CA18 reads each entry as its name, its date, its amount and the legend", async () => {
    await open(COMPTE_COURANT);
    await screen.findByText("Salaire");

    expect(
      screen.getByLabelText(`Salaire, 10${NBSP}novembre, +6’000.00 CHF`),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        `Valeur enregistrée, 1er${NBSP}novembre, 5’000.00 CHF`,
      ),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        `Assurance, 28${NBSP}octobre, −300.00 CHF, Déjà compris dans ta saisie du 1er${NBSP}novembre`,
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText("Retour à Mon patrimoine")).toBeTruthy();
  });

  it("CA18 reads no amount while amounts are hidden, nor one with no rate", async () => {
    pages[`${COMPTE_COURANT}:`] = page(compteCourant, [
      movement(9, "Courses", "2026-11-12T09:00:00.000Z", null),
      ENTRY_NOV,
    ]);
    await open(COMPTE_COURANT);

    expect(await screen.findByText("—")).toBeTruthy();
    expect(screen.getByLabelText(`Courses, 12${NBSP}novembre`)).toBeTruthy();

    await act(async () =>
      useAmountVisibility.setState({ areAmountsHidden: true }),
    );
    expect(
      await screen.findByLabelText(`Valeur enregistrée, 1er${NBSP}novembre`),
    ).toBeTruthy();
    await act(async () =>
      useAmountVisibility.setState({ areAmountsHidden: false }),
    );
  });

  it("CA8 drops an unchecked movement when the tab is shown again", async () => {
    await open(COMPTE_COURANT);
    await screen.findByText("Restaurant");
    pages[`${COMPTE_COURANT}:`] = page(
      { ...compteCourant, latestValue: 9500 },
      COMPTE_ENTRIES.filter((entry) => entry !== RESTAURANT),
    );

    // What unchecking it in a budget does to this read, then coming back.
    await act(() => invalidateAfterBudgetWrite(queryClient));
    expect(historyCalls()).toHaveLength(1);
    await act(async () => mockFocus());

    expect(await screen.findByLabelText("Comptes 9’500.00 CHF")).toBeTruthy();
    expect(screen.queryByText("Restaurant")).toBeNull();
  });

  it("CA9 puts a new entry on top and keeps the movements under it", async () => {
    await open(COMPTE_COURANT);
    await screen.findByText("Salaire");
    pages[`${COMPTE_COURANT}:`] = page(
      { ...compteCourant, latestValue: 9000, recordedValue: 9000 },
      [snapshot(7, "2026-11-24T08:00:00.000Z", 9000), ...COMPTE_ENTRIES],
    );

    // What every write on « Mon patrimoine » does once it settles.
    await act(() =>
      queryClient.invalidateQueries({ queryKey: netWorthKeys.all }),
    );

    expect(
      await screen.findByLabelText(
        `Valeur enregistrée, 24${NBSP}novembre, 9’000.00 CHF`,
      ),
    ).toBeTruthy();
    expect(rowTitles().slice(0, 4)).toEqual([
      "Valeur enregistrée",
      "Salaire",
      "Restaurant",
      "Loyer",
    ]);
  });

  it("CA10 says nothing was checked since the Livret's only entry", async () => {
    pages[`${LIVRET}:`] = page(livret, [snapshot(8, NOV_1, 10_000)]);
    await open(LIVRET);

    expect(
      await screen.findByText(
        `Tu n'as rien pointé depuis ta saisie du 1er${NBSP}novembre.`,
      ),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        `Valeur enregistrée, 1er${NBSP}novembre, 10’000.00 CHF`,
      ),
    ).toBeTruthy();
  });

  it("CA10 stays silent while movements sit above the last entry", async () => {
    await open(COMPTE_COURANT);
    await screen.findByText("Salaire");

    expect(screen.queryByText(/Tu n'as rien pointé/)).toBeNull();
  });

  it("CA11 opens on the newest page and loads the next one going down", async () => {
    pages[`${COMPTE_COURANT}:`] = page(
      compteCourant,
      COMPTE_ENTRIES.slice(0, 2),
      "page-2",
    );
    pages[`${COMPTE_COURANT}:page-2`] = page(
      compteCourant,
      COMPTE_ENTRIES.slice(2),
    );
    await open(COMPTE_COURANT);
    await screen.findByText("Restaurant");
    expect(screen.queryByText("Loyer")).toBeNull();

    await act(async () => {
      screen.getByTestId("asset-history").props.onEndReached();
    });

    expect(await screen.findByText("Assurance")).toBeTruthy();
    expect(historyCalls().map(([, , query]) => query?.cursor)).toEqual([
      undefined,
      "page-2",
    ]);
    expect(rowTitles()).toHaveLength(6);
  });

  it("CA12 opens the existing sheet from « Modifier »", async () => {
    await open(COMPTE_COURANT);
    await screen.findByText("Salaire");

    await fireEvent.press(screen.getByLabelText("Modifier"));

    expect(screen.getByText("sheet:Compte courant")).toBeTruthy();
  });

  it("CA14 shows each effect in the element's own currency", async () => {
    const euros = { ...compteCourant, currency: "EUR" as const };
    pages[`${COMPTE_COURANT}:`] = page(euros, [RESTAURANT, ENTRY_NOV]);
    await open(COMPTE_COURANT);

    expect(await screen.findByText(/^−80,00\s€$/)).toBeTruthy();
    expect(screen.getByText(/^5\s000,00\s€$/)).toBeTruthy();
  });

  it("CA15 says an archived or unknown element is no longer there", async () => {
    pages[`${COMPTE_COURANT}:`] = new ApiError(
      "Not found",
      "ERR_ASSET_NOT_FOUND",
      404,
      null,
    );
    await open(COMPTE_COURANT);

    expect(
      await screen.findByText("Cet élément n'est plus disponible"),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Modifier")).toBeNull();
    await fireEvent.press(screen.getByText("Retour à Mon patrimoine"));
    expect(router.back).toHaveBeenCalled();
  });
});
