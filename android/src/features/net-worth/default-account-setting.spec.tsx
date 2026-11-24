import { fireEvent, render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";

import DefaultAccountScreen from "@/app/(main)/(tabs)/(home)/settings/default-account";
import PreferencesScreen from "@/app/(main)/(tabs)/(home)/settings/preferences";
import {
  contractAssets,
  COMPTE_COURANT,
  LIVRET,
} from "@/core/testing/net-worth-accounts";

const mockRouter = { back: jest.fn(), push: jest.fn() };
const mockUpdate = { mutate: jest.fn(), isPending: false };
let mockState: {
  isFlagOn: boolean;
  defaultAccountId: string | null;
  assets: ReturnType<typeof contractAssets>;
} = { isFlagOn: true, defaultAccountId: null, assets: contractAssets() };

jest.mock("expo-router", () => ({
  router: {
    back: () => mockRouter.back(),
    push: (path: string) => mockRouter.push(path),
  },
}));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  SafeAreaView: jest.requireActual("react-native").View,
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
jest.mock("@/core/ui/screen-app-bar", () => ({
  ScreenAppBar: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/core/ui/pull-to-refresh", () => ({
  usePullToRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }),
}));
jest.mock("@/core/observability/feature-flags", () => ({
  useFeatureFlag: () => mockState.isFlagOn,
}));
jest.mock("@/features/net-worth/net-worth-queries", () => ({
  useNetWorth: () => ({ data: { assets: mockState.assets } }),
}));
jest.mock("@/core/user-settings/user-settings-queries", () => ({
  useUserSettings: () => ({
    data: {
      currency: "CHF",
      payDayOfMonth: 25,
      defaultAccountId: mockState.defaultAccountId,
    },
    refetch: jest.fn(),
  }),
}));
jest.mock("@/features/account/account-queries", () => ({
  useUpdateUserSettings: () => mockUpdate,
}));
jest.mock("@/features/current-month/current-month-queries", () => ({
  useCurrentMonth: () => ({ details: null }),
}));
jest.mock("@/core/notifications/scheduler", () => ({}));
jest.mock("@/core/notifications/reminder-flags", () => ({
  readRemindersEnabled: () => false,
  readWeeklyRecapEnabled: () => false,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockState = {
    isFlagOn: true,
    defaultAccountId: null,
    assets: contractAssets(),
  };
});

const inApp = (screen: React.ReactNode) => (
  <PaperProvider>{screen}</PaperProvider>
);

describe("« Compte par défaut » in the preferences (CA28)", () => {
  it("reads « Aucun » until an account is chosen, then the account's name", async () => {
    const none = await render(inApp(<PreferencesScreen />));
    expect(none.getByText("Compte par défaut")).toBeTruthy();
    expect(none.getByText("Aucun")).toBeTruthy();
    // A description like its neighbours, the account on the right as their value.
    expect(
      none.getByText(
        "Chaque nouvelle saisie démarre sur ce compte. Tu peux le changer à chaque fois.",
      ),
    ).toBeTruthy();

    mockState.defaultAccountId = COMPTE_COURANT;
    const set = await render(inApp(<PreferencesScreen />));
    expect(set.getAllByText("Compte courant").length).toBeGreaterThan(0);
  });

  it("opens the choice of account", async () => {
    const view = await render(inApp(<PreferencesScreen />));
    await fireEvent.press(view.getByTestId("settings-default-account"));

    expect(mockRouter.push).toHaveBeenCalledWith("/settings/default-account");
  });

  it("is absent with the flag off, or without an active element", async () => {
    mockState.isFlagOn = false;
    const off = await render(inApp(<PreferencesScreen />));
    expect(off.queryByText("Compte par défaut")).toBeNull();

    mockState = { ...mockState, isFlagOn: true, assets: [] };
    const empty = await render(inApp(<PreferencesScreen />));
    expect(empty.queryByText("Compte par défaut")).toBeNull();
  });
});

describe("the choice of default account (CA28, CA34, CA35)", () => {
  it("lists « Aucun », what I have, then what I owe, a debt included", async () => {
    const view = await render(inApp(<DefaultAccountScreen />));

    for (const name of [
      "Aucun",
      "Ce que j'ai",
      "Compte courant",
      "Revolut",
      "Livret",
      "Ce que je dois",
      "Leasing",
      "Carte de crédit",
    ]) {
      expect(view.getAllByText(name).length).toBeGreaterThan(0);
    }
    expect(view.getAllByRole("radio")[0]).toHaveProp(
      "accessibilityLabel",
      "Aucun",
    );
  });

  it("CA28 writes the account chosen, CA34 « Aucun » as null", async () => {
    mockState.defaultAccountId = COMPTE_COURANT;
    const view = await render(inApp(<DefaultAccountScreen />));

    await fireEvent.press(view.getByText("Livret"));
    expect(mockUpdate.mutate.mock.calls[0][0]).toEqual({
      defaultAccountId: LIVRET,
    });

    await fireEvent.press(view.getByText("Aucun"));
    expect(mockUpdate.mutate.mock.calls[1][0]).toEqual({
      defaultAccountId: null,
    });
  });

  it("CA35 reads an archived default as « Aucun »", async () => {
    mockState.defaultAccountId = COMPTE_COURANT;
    mockState.assets = contractAssets([
      { archivedAt: "2026-11-02T00:00:00.000Z" },
    ]);
    const view = await render(inApp(<DefaultAccountScreen />));

    const none = view.getAllByRole("radio")[0];
    expect(none.props.accessibilityState).toMatchObject({ checked: true });
  });
});
