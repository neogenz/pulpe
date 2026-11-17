import { fireEvent, render } from "@testing-library/react-native";
import type { Asset, NetWorth } from "pulpe-shared";
import { PaperProvider } from "react-native-paper";

import NetWorthScreen from "@/app/(main)/(tabs)/net-worth";
import { useNetWorth } from "@/features/net-worth/net-worth-queries";

let mockHasSeenIntro = false;

let mockIsFocused = true;
jest.mock("expo-router", () => ({
  useFocusEffect: () => undefined,
  useIsFocused: () => mockIsFocused,
}));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/features/net-worth/net-worth-intro-gate", () => ({
  hasSeenNetWorthIntro: () => mockHasSeenIntro,
  markNetWorthIntroSeen: () => {
    mockHasSeenIntro = true;
  },
}));
jest.mock("@/features/net-worth/net-worth-queries", () => {
  const mutation = () => ({ mutate: jest.fn() });
  return {
    refetchStaleNetWorth: jest.fn(),
    useNetWorth: jest.fn(),
    useDeleteAsset: mutation,
    useDismissAssetSuggestion: mutation,
    useRecordAssetSnapshots: mutation,
    useUpdateAsset: mutation,
  };
});
// The sheets are tested on their own; here they only say they are open and
// hand back the outcome the tab reacts to.
jest.mock("@/features/net-worth/components/net-worth-intro-sheet", () => {
  const { Pressable: Press, Text: Label } = jest.requireActual("react-native");
  return {
    NetWorthIntroSheet: ({
      source,
      isEmpty,
      onFinish,
    }: {
      source: string;
      isEmpty: boolean;
      onFinish: (outcome: object) => void;
    }) => (
      <>
        <Label>{`intro:${source}`}</Label>
        <Press
          testID="intro-primary"
          onPress={() =>
            onFinish({ kind: "completed", action: isEmpty ? "add" : "done" })
          }
        />
        <Press
          testID="intro-later"
          onPress={() => onFinish({ kind: "skipped", step: 0 })}
        />
      </>
    ),
  };
});
jest.mock("@/features/net-worth/components/asset-form-sheet", () => {
  const { Text: Label } = jest.requireActual("react-native");
  return { AssetFormSheet: () => <Label>asset-form</Label> };
});
jest.mock("@/features/net-worth/components/net-worth-hero", () => ({
  NetWorthHero: () => null,
}));
jest.mock("@/features/net-worth/components/net-worth-allocation", () => ({
  NetWorthAllocation: () => null,
}));
jest.mock("@/features/net-worth/components/asset-group-card", () => ({
  AssetGroupCard: () => null,
  AssetRows: () => null,
}));

const CATEGORY = "00000000-0000-4000-8000-000000000001";

const account: Asset = {
  id: "00000000-0000-4000-8000-0000000000aa",
  categoryId: CATEGORY,
  name: "Compte",
  currency: "CHF",
  direction: "own",
  inPulpe: false,
  archivedAt: null,
  latestValue: 100,
  latestRecordedAt: "2026-11-01T10:00:00.000Z",
  convertedValue: 100,
  suggestion: null,
};

function netWorth(assets: Asset[]): NetWorth {
  const gross = assets.reduce((sum, a) => sum + (a.convertedValue ?? 0), 0);
  return {
    totals: {
      baseCurrency: "CHF",
      gross,
      debts: 0,
      net: gross,
      incomplete: false,
    },
    categories: [{ id: CATEGORY, name: "Comptes", total: gross }],
    assets,
  };
}

function serve(data: NetWorth | undefined, isPending = false) {
  jest.mocked(useNetWorth).mockReturnValue({
    data,
    isPending,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useNetWorth>);
}

const renderTab = () =>
  render(
    <PaperProvider>
      <NetWorthScreen />
    </PaperProvider>,
  );

beforeEach(() => {
  mockHasSeenIntro = false;
  mockIsFocused = true;
});

it("opens the explainer by itself once the net worth has loaded, then never again", async () => {
  serve(undefined, true);
  const view = await renderTab();
  expect(view.queryByText("intro:auto")).toBeNull();

  serve(netWorth([account]));
  await view.rerender(
    <PaperProvider>
      <NetWorthScreen />
    </PaperProvider>,
  );
  expect(view.getByText("intro:auto")).toBeTruthy();

  await fireEvent.press(view.getByTestId("intro-later"));
  expect(view.queryByText("intro:auto")).toBeNull();

  await view.unmount();
  const again = await renderTab();
  expect(again.queryByText("intro:auto")).toBeNull();
});

it("waits for the tab to be back in front when the net worth lands after the user left", async () => {
  mockIsFocused = false;
  serve(netWorth([account]));
  const view = await renderTab();
  expect(view.queryByText("intro:auto")).toBeNull();

  mockIsFocused = true;
  await view.rerender(
    <PaperProvider>
      <NetWorthScreen />
    </PaperProvider>,
  );
  expect(view.getByText("intro:auto")).toBeTruthy();
});

it("reopens from « ? » once already seen", async () => {
  mockHasSeenIntro = true;
  serve(netWorth([account]));
  const view = await renderTab();
  expect(view.queryByText("intro:help")).toBeNull();

  await fireEvent.press(view.getByLabelText("netWorth.intro.help"));

  expect(view.getByText("intro:help")).toBeTruthy();
});

it("leads an empty net worth from the explainer to the creation form", async () => {
  serve(netWorth([]));
  const view = await renderTab();
  expect(view.queryByText("asset-form")).toBeNull();

  await fireEvent.press(view.getByTestId("intro-primary"));

  expect(view.queryByText("intro:auto")).toBeNull();
  expect(view.getByText("asset-form")).toBeTruthy();
});

it("closes on « Compris » without opening the form when accounts exist", async () => {
  serve(netWorth([account]));
  const view = await renderTab();

  await fireEvent.press(view.getByTestId("intro-primary"));

  expect(view.queryByText("intro:auto")).toBeNull();
  expect(view.queryByText("asset-form")).toBeNull();
});
