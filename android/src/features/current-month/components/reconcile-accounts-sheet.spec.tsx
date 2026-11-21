import { act, fireEvent, render } from "@testing-library/react-native";
import type {
  Asset,
  BudgetLine,
  NetWorth,
  ReconciliationContext,
  Transaction,
} from "pulpe-shared";

import { captureEvent } from "@/core/observability/analytics";

import type { RealizedMetrics } from "../current-month-view-model";
import {
  clearReconcileDraft,
  keepReconcileDraft,
} from "../reconcile-draft-store";
import {
  clearFreeAccounts,
  readFreeAccounts,
} from "../reconcile-free-accounts";
import type { LinkedAccounts } from "../reconcile-linked-accounts";
import { forgetReconciliationContext } from "../reconciliation-queries";
import {
  type ReconcileMonth,
  ReconcileAccountsSheet,
} from "./reconcile-accounts-sheet";

const mockCreate = {
  mutate: jest.fn(),
  reset: jest.fn(),
  isPending: false,
  isError: false,
};

let mockUuidCount = 0;
jest.mock("react-native-quick-crypto", () => ({
  randomUUID: () => `adjustment-${(mockUuidCount += 1)}`,
}));
jest.mock("@/features/transactions/transaction-mutations", () => ({
  useCreateTransaction: () => mockCreate,
}));
const mockFollow = { mutate: jest.fn(), reset: jest.fn(), isError: false };
// The real linked-accounts hook runs on top of these two: its filter is under test.
const mockNetWorth: {
  isOn: boolean;
  isFetching: boolean;
  data: NetWorth | undefined;
} = { isOn: false, isFetching: false, data: undefined };
/** `null`: flag off. `undefined`: still loading. Else the flag is on with this data. */
function offer(linked: LinkedAccounts | null | undefined) {
  mockNetWorth.isOn = linked !== null;
  mockNetWorth.isFetching = linked === undefined;
  mockNetWorth.data = linked
    ? ({ categories: linked.categories, assets: linked.assets } as NetWorth)
    : undefined;
}
jest.mock("@/features/net-worth/net-worth-queries", () => ({
  useFollowAccounts: () => mockFollow,
  useNetWorth: () => mockNetWorth,
}));
jest.mock("@/core/observability/feature-flags", () => ({
  useFeatureFlag: () => mockNetWorth.isOn,
}));
jest.mock("@/core/ui/ripple", () => ({ useRipple: () => ({ color: "gray" }) }));
jest.mock("@/core/ui/segmented-picker", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    SegmentedPicker: ({
      value,
      onValueChange,
      buttons,
      accessibilityLabel,
    }: {
      value: string;
      onValueChange: (value: string) => void;
      buttons: { value: string; label: string }[];
      accessibilityLabel: string;
    }) => (
      <View accessibilityLabel={accessibilityLabel}>
        <Text>{`side:${value}`}</Text>
        {buttons.map((button) => (
          <Pressable
            key={button.value}
            onPress={() => onValueChange(button.value)}
          >
            <Text>{button.label}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
});
const CONTEXT: ReconciliationContext = {
  startingAmount: 0,
  hasCompletedComparison: true,
  priorCorrection: 0,
  priorItems: [],
};
const mockContext = {
  data: CONTEXT as ReconciliationContext | undefined,
  isError: false,
  isFetching: false,
  refetch: jest.fn(),
};
jest.mock("../reconciliation-queries", () => ({
  useReconciliationContext: () => mockContext,
  forgetReconciliationContext: jest.fn(),
}));
const mockCompleteReconciliation = jest.fn(() => Promise.resolve());
jest.mock("../reconciliation-api", () => ({
  completeReconciliation: () => mockCompleteReconciliation(),
}));
jest.mock("@/core/observability/analytics", () => ({
  captureEvent: jest.fn(),
}));
jest.mock("@/core/ui/haptics", () => ({
  hapticSuccess: jest.fn(),
  hapticFailure: jest.fn(),
}));
// This month's items and the previous months' go through a mutation each.
const mockToggle = { mutateAsync: jest.fn(() => Promise.resolve()) };
const mockTogglePrior = { mutateAsync: jest.fn(() => Promise.resolve()) };
const mockChecksSettled = jest.fn(() => Promise.resolve());
jest.mock("@/features/budgets/toggle-check-mutation", () => ({
  useToggleCheck: (budgetId: string | null) =>
    budgetId === null ? mockTogglePrior : mockToggle,
  useChecksSettled: () => () => mockChecksSettled(),
}));
jest.mock("@/core/ui/amount-visibility", () => ({
  areAmountsHidden: () => false,
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({
    locale: "fr-CH",
    t: (key: string, params?: Record<string, unknown>) =>
      params === undefined ? key : `${key}:${Object.values(params).join("|")}`,
  }),
}));
jest.mock("@/core/ui/theme", () => ({
  RADIUS: { card: 18 },
  SPACING: { lg: 24, md: 16, sm: 8, xs: 4, xxs: 2 },
  TOUCH_TARGET: 48,
  TABULAR_DIGITS: {},
}));
jest.mock("@/core/ui/scheme-colors", () => ({
  useV2Colors: () => ({
    accentWash: "mint",
    accentInk: "green",
    overWash: "sand",
  }),
  useFinancialColors: () => ({ overBudget: "ochre" }),
}));
jest.mock("@/core/ui/amount", () => {
  const { Text } = jest.requireActual("react-native");
  return { Amount: Text };
});
jest.mock("@/core/ui/field-error", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    FieldError: ({ children }: { children: React.ReactNode }) => (
      <Text>{children}</Text>
    ),
  };
});
jest.mock("@/core/ui/notice", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    Notice: ({
      visible,
      children,
    }: {
      visible: boolean;
      children: React.ReactNode;
    }) =>
      visible ? <Text testID="reconcile-error-notice">{children}</Text> : null,
  };
});
jest.mock("react-native-paper", () => {
  const { Pressable, Text, TextInput, View } =
    jest.requireActual("react-native");
  return {
    Button: ({
      children,
      onPress,
      disabled,
      accessibilityLabel,
    }: {
      children: React.ReactNode;
      onPress?: () => void;
      disabled?: boolean;
      accessibilityLabel?: string;
    }) => (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !!disabled }}
      >
        <Text>{children}</Text>
      </Pressable>
    ),
    IconButton: ({
      onPress,
      accessibilityLabel,
      accessibilityState,
    }: {
      onPress: () => void;
      accessibilityLabel: string;
      accessibilityState?: { selected?: boolean };
    }) => (
      <Pressable
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
      />
    ),
    ActivityIndicator: () => <View testID="reconcile-loading" />,
    Icon: () => null,
    ProgressBar: () => <View testID="reconcile-progress" />,
    Text,
    TextInput: Object.assign(
      ({
        label,
        value,
        onChangeText,
        onFocus,
        onBlur,
        onSubmitEditing,
        autoFocus,
      }: {
        label: string;
        value: string;
        onChangeText: (value: string) => void;
        onFocus?: () => void;
        onBlur?: () => void;
        onSubmitEditing?: () => void;
        autoFocus?: boolean;
      }) => (
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          onSubmitEditing={onSubmitEditing}
          autoFocus={autoFocus}
        />
      ),
      { Affix: () => null },
    ),
    useTheme: () => ({
      colors: { onSurfaceVariant: "gray", surfaceVariant: "beige" },
    }),
    Divider: () => <View />,
  };
});
let mockSeenGuide = true;
const mockSeenListeners = new Set<() => void>();
const mockMarkSeen = jest.fn();
jest.mock("../reconcile-guide-gate", () => {
  const { useSyncExternalStore } = jest.requireActual("react");
  return {
    useHasSeenReconcileGuide: () =>
      useSyncExternalStore(
        (listener: () => void) => {
          mockSeenListeners.add(listener);
          return () => mockSeenListeners.delete(listener);
        },
        () => mockSeenGuide,
      ),
    markReconcileGuideSeen: () => {
      mockMarkSeen();
      mockSeenGuide = true;
      mockSeenListeners.forEach((listener) => listener());
    },
  };
});
// The guide's own behavior is its page's spec; here it only has to be a page.
const mockGuideSkip = jest.fn();
jest.mock("./reconcile-guide-page", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    useReconcileGuidePage: ({
      source,
      onFinish,
    }: {
      source: string | null;
      onFinish: (outcome: string) => void;
    }) =>
      source === null
        ? null
        : {
            skip: () => {
              mockGuideSkip(source);
              onFinish("skipped");
            },
            skipAction: <Text>skip-action</Text>,
            body: <Text>{`guide:${source}`}</Text>,
            footer: (
              <Pressable
                accessibilityLabel="guide-start"
                onPress={() => onFinish("completed")}
              />
            ),
          },
  };
});
const mockReveal = jest.fn();
jest.mock("@/core/ui/sheet", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    useRevealInSheet: () => mockReveal,
    FormModal: ({
      title,
      subtitle,
      children,
      footer,
      onDismiss,
      onBack,
      isBusy,
      isVisible,
      headerAction,
    }: {
      title: string;
      subtitle?: string;
      children: React.ReactNode;
      footer: React.ReactNode;
      onDismiss: () => void;
      onBack?: () => void;
      isBusy: boolean;
      isVisible: boolean;
      headerAction?: React.ReactNode;
    }) =>
      isVisible ? (
        <View>
          <Text>{title}</Text>
          <Text>{subtitle}</Text>
          <Text>{`busy:${isBusy}`}</Text>
          {headerAction}
          {children}
          {footer}
          <Pressable
            accessibilityLabel="scrim"
            onPress={isBusy ? undefined : onDismiss}
          />
          <Pressable
            accessibilityLabel="android-back"
            onPress={isBusy ? undefined : (onBack ?? onDismiss)}
          />
        </View>
      ) : null,
  };
});

const REALIZED: RealizedMetrics = {
  realizedIncome: 5000,
  realizedExpenses: 3380.01,
  realizedSpending: 3080.01,
  realizedSavings: 300,
  realizedBalance: 1499.99,
  checkedItemsCount: 4,
  totalItemsCount: 6,
};
const REALIZED_LEVEL: RealizedMetrics = { ...REALIZED, realizedBalance: 1500 };

function renderSheet(
  realized: Partial<RealizedMetrics> = {},
  transactions: Transaction[] = [],
  budgetLines: BudgetLine[] = [],
) {
  const month: ReconcileMonth = {
    realized: { ...REALIZED, ...realized },
    available: 900,
    budgetLines,
    transactions,
  };
  const props = {
    isVisible: true,
    onDismiss: jest.fn(),
    onRecorded: jest.fn(),
    onViewItemsToCheck: jest.fn(),
    onRecordFailed: jest.fn(),
    budgetId: "budget-1",
    month,
    currency: "CHF" as const,
  };
  return { props, view: render(<ReconcileAccountsSheet {...props} />) };
}

async function reachVerdict(
  view: Awaited<ReturnType<typeof renderSheet>["view"]>,
  amount: string,
) {
  await fireEvent.changeText(view.getByLabelText(AMOUNT), amount);
  await fireEvent.press(view.getByText("home.reconcile.accounts.compare"));
}

const AMOUNT = "home.reconcile.accounts.amount";
const STEP_2 = "home.reconcile.compare.stepLabel";
const NOTE_INCOME = /home\.reconcile\.compare\.yesNoteIncome/;
const NOTE_EXPENSE = /home\.reconcile\.compare\.yesNoteExpense/;

beforeEach(() => {
  jest.clearAllMocks();
  mockSeenGuide = true;
  Object.assign(mockCreate, { isPending: false, isError: false });
  Object.assign(mockContext, {
    data: CONTEXT,
    isError: false,
    isFetching: false,
  });
  offer(null);
  clearReconcileDraft();
  clearFreeAccounts();
});

function account(
  id: string,
  inPulpe: boolean,
  direction: "own" | "owe" = "own",
): Asset {
  return {
    id,
    categoryId: "type",
    name: `Compte ${id}`,
    currency: "CHF",
    direction,
    inPulpe,
    archivedAt: null,
    latestValue: 100,
    latestRecordedAt: "2026-11-01T10:00:00.000Z",
    convertedValue: 100,
    suggestion: null,
  };
}

describe("guide", () => {
  const HELP = "home.reconcile.guide.help";
  const BARE_PROPS = {
    isVisible: true,
    onDismiss: jest.fn(),
    onRecorded: jest.fn(),
    onViewItemsToCheck: jest.fn(),
    onRecordFailed: jest.fn(),
    budgetId: "budget-1",
    currency: "CHF" as const,
  };
  const MONTH: ReconcileMonth = {
    realized: REALIZED,
    available: 900,
    budgetLines: [],
    transactions: [],
  };
  async function open() {
    const { props, view } = renderSheet();
    return { props, view: await view };
  }

  it("opens on the guide the first time, then on step 1 once it is left", async () => {
    mockSeenGuide = false;
    const { view } = await open();
    expect(await view.getByText("guide:auto")).toBeTruthy();
    expect(view.queryByLabelText(AMOUNT)).toBeNull();
    expect(view.queryByLabelText(HELP)).toBeNull();

    await fireEvent.press(view.getByLabelText("guide-start"));

    expect(mockMarkSeen).toHaveBeenCalledTimes(1);
    expect(view.getByLabelText(AMOUNT)).toBeTruthy();
  });

  it("counts the back action as skipped and goes on to step 1", async () => {
    mockSeenGuide = false;
    const { view } = await open();

    await fireEvent.press(view.getByLabelText("android-back"));

    expect(mockGuideSkip).toHaveBeenCalledWith("auto");
    expect(mockMarkSeen).toHaveBeenCalledTimes(1);
    expect(view.getByLabelText(AMOUNT)).toBeTruthy();
  });

  it("counts the scrim as skipped and closes the sheet", async () => {
    mockSeenGuide = false;
    const { view, props } = await open();

    await fireEvent.press(await view.getByLabelText("scrim"));

    expect(mockGuideSkip).toHaveBeenCalledWith("auto");
    expect(mockMarkSeen).toHaveBeenCalledTimes(1);
    expect(props.onDismiss).toHaveBeenCalledTimes(1);
  });

  it("keeps the typed values when ✕ or the scrim leaves a replay", async () => {
    const { view, props } = await open();
    await fireEvent.changeText(view.getByLabelText(AMOUNT), "890");
    await fireEvent.press(view.getByLabelText(HELP));
    expect(view.getByText("guide:help")).toBeTruthy();

    await fireEvent.press(view.getByLabelText("scrim"));

    expect(mockGuideSkip).toHaveBeenCalledWith("help");
    expect(props.onDismiss).not.toHaveBeenCalled();
    expect(view.getByLabelText(AMOUNT).props.value).toBe("890");
  });

  it("shows the guide in one sheet only once the other has been through it", async () => {
    mockSeenGuide = false;
    const view = await render(
      <>
        <ReconcileAccountsSheet {...BARE_PROPS} month={MONTH} />
        <ReconcileAccountsSheet {...BARE_PROPS} month={MONTH} />
      </>,
    );
    expect(view.getAllByText("guide:auto")).toHaveLength(2);

    await fireEvent.press(view.getAllByLabelText("guide-start")[0]);

    expect(view.queryByText("guide:auto")).toBeNull();
    expect(mockMarkSeen).toHaveBeenCalledTimes(1);
  });

  it("counts the guide as skipped when the month leaves under it", async () => {
    mockSeenGuide = false;
    await render(<ReconcileAccountsSheet {...BARE_PROPS} month={null} />);
    expect(mockGuideSkip).toHaveBeenCalledWith("auto");
    expect(mockMarkSeen).toHaveBeenCalled();
  });

  it("replays from « ? » over the typed values and gives them back", async () => {
    const { view } = await open();
    expect(view.queryByText(/^guide:/)).toBeNull();
    await fireEvent.changeText(view.getByLabelText(AMOUNT), "890");

    await fireEvent.press(view.getByLabelText(HELP));
    expect(await view.getByText("guide:help")).toBeTruthy();
    await fireEvent.press(view.getByLabelText("guide-start"));

    expect(view.getByLabelText(AMOUNT).props.value).toBe("890");
  });

  it("gives a new row the keyboard once, never again when the guide gives step 1 back", async () => {
    const { view } = await open();
    const NAME = "home.reconcile.accounts.accountName";
    await fireEvent.press(view.getByText("home.reconcile.accounts.addOwe"));
    const added = view.getAllByLabelText(NAME)[1];
    expect(added.props.autoFocus).toBe(true);
    await fireEvent(added, "focus");

    await fireEvent.press(view.getByLabelText(HELP));
    await fireEvent.press(view.getByLabelText("guide-start"));

    for (const field of view.getAllByLabelText(NAME)) {
      expect(field.props.autoFocus).toBeFalsy();
    }
  });
});

it("brings a focused row above the footer and the keyboard, and lets go on blur", async () => {
  const view = await renderSheet().view;
  const amount = view.getByLabelText(AMOUNT);

  await fireEvent(amount, "focus");
  expect(mockReveal).toHaveBeenLastCalledWith(expect.anything());
  expect(mockReveal.mock.lastCall?.[0]).not.toBeNull();

  await fireEvent(amount, "blur");
  expect(mockReveal).toHaveBeenLastCalledWith(null);
});

describe("with Mon patrimoine", () => {
  const BALANCE = "home.reconcile.accounts.amount";
  const linked = (...assets: Asset[]): LinkedAccounts => ({
    categories: [{ id: "type", name: "Comptes", total: 0 }],
    assets,
  });

  it("waits for my accounts before showing a row", async () => {
    offer(undefined);
    const view = await renderSheet().view;
    expect(view.getByTestId("reconcile-loading")).toBeTruthy();
    expect(view.queryByLabelText(BALANCE)).toBeNull();
    expect(mockFollow.mutate).not.toHaveBeenCalled();
  });

  it("opens on my followed accounts and writes the finished ones on completion", async () => {
    offer(
      linked(
        account("a", true),
        account("b", false),
        account("card", true, "owe"),
      ),
    );
    const view = await renderSheet(REALIZED_LEVEL).view;
    expect(view.getByText("Compte a")).toBeTruthy();
    expect(
      view.getAllByText("home.reconcile.accounts.linkedCaption"),
    ).toHaveLength(2);
    expect(
      view.getAllByText("home.reconcile.accounts.cardCaption"),
    ).toHaveLength(1);

    // « Compte a » leaves the comparison, « Compte b » joins it from the add sheet.
    await fireEvent.press(
      view.getByLabelText("home.reconcile.accounts.remove:Compte a"),
    );
    await fireEvent.press(view.getByText("home.reconcile.accounts.addAccount"));
    await fireEvent.press(view.getByTestId("reconcile-add-asset-b"));
    const [card, added] = view.getAllByLabelText(BALANCE);
    await fireEvent.changeText(card, "500");
    await fireEvent.changeText(added, "2000");

    expect(view.getByTestId("reconcile-total")).toHaveTextContent(/1’500\.00/);
    await fireEvent.press(view.getByText("home.reconcile.accounts.compare"));
    await fireEvent.press(view.getByText("home.reconcile.compare.finish"));

    expect(mockFollow.mutate).toHaveBeenCalledTimes(1);
    expect(mockFollow.mutate).toHaveBeenCalledWith({
      links: ["b"],
      unlinks: ["a"],
      snapshots: [
        { assetId: "card", value: 500 },
        { assetId: "b", value: 2000 },
      ],
    });
  });

  async function openAddSheet(assets: Asset[], isOn: boolean) {
    // The same cached data in both cases: only the flag differs.
    offer(linked(...assets));
    mockNetWorth.isOn = isOn;
    const view = await renderSheet().view;
    await fireEvent.press(view.getByText("home.reconcile.accounts.addAccount"));
    return view;
  }
  const ELIGIBLE = account("b", false);
  const ARCHIVED = { ...account("old", false), archivedAt: "2026-01-01" };

  it("offers the eligible accounts with the flag on, never an archived one", async () => {
    const view = await openAddSheet([ELIGIBLE, ARCHIVED], true);
    expect(view.getByTestId("reconcile-add-asset-b")).toBeTruthy();
    expect(view.queryByTestId("reconcile-add-asset-old")).toBeNull();
  });

  it("offers none of them with the flag off, whatever is cached", async () => {
    const view = await openAddSheet([ELIGIBLE], false);
    expect(view.getByTestId("reconcile-add-own")).toBeTruthy();
    expect(view.queryByTestId("reconcile-add-asset-b")).toBeNull();
  });

  it("brings an account deleted while locked back as a free row, and writes nothing to it", async () => {
    offer(linked(account("a", true)));
    keepReconcileDraft("budget-1", [
      {
        id: 0,
        label: "Compte a",
        amountText: "1500",
        side: "own",
        account: { kind: "asset", id: "a" },
      },
      {
        id: 1,
        label: "Compte gone",
        amountText: "20",
        side: "own",
        account: { kind: "asset", id: "gone" },
      },
    ]);
    const view = await renderSheet(REALIZED).view;
    expect(
      view.getByLabelText("home.reconcile.accounts.accountName").props.value,
    ).toBe("Compte gone");
    await fireEvent.press(view.getByText("home.reconcile.accounts.compare"));
    await fireEvent.press(view.getByText(NOTE_INCOME));
    await act(() => mockCreate.mutate.mock.calls[0][1].onSuccess());
    expect(mockFollow.mutate).toHaveBeenCalledWith({
      links: [],
      unlinks: [],
      snapshots: [{ assetId: "a", value: 1500 }],
    });
  });

  it("gives a new row its own id: nothing is inherited from a removed one", async () => {
    const view = await renderSheet().view;
    const first = view.getByLabelText(AMOUNT);
    await fireEvent.changeText(first, "12.");
    await fireEvent(first, "blur");
    expect(
      view.getByText("home.reconcile.accounts.invalidAmount"),
    ).toBeTruthy();

    await fireEvent.press(
      view.getByLabelText(
        "home.reconcile.accounts.remove:home.reconcile.accounts.accountNumbered:1",
      ),
    );
    await fireEvent.press(view.getByText("home.reconcile.accounts.addAccount"));
    await fireEvent.press(view.getByTestId("reconcile-add-own"));
    await fireEvent.changeText(view.getByLabelText(AMOUNT), "12.");

    expect(
      view.queryByText("home.reconcile.accounts.invalidAmount"),
    ).toBeNull();
  });

  it("saves the balances once, as they stand when the sheet closes after a completed comparison", async () => {
    offer(linked(account("a", true)));
    const { props, view: pending } = renderSheet({ realizedBalance: 4200 });
    const view = await pending;
    await reachVerdict(view, "4000");
    await fireEvent.press(view.getByLabelText("android-back"));
    await fireEvent.changeText(view.getByLabelText(BALANCE), "4200");
    await fireEvent.press(view.getByText("home.reconcile.accounts.compare"));
    await fireEvent.press(view.getByText("home.reconcile.compare.finish"));

    expect(mockFollow.mutate).toHaveBeenCalledTimes(1);
    expect(mockFollow.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ snapshots: [{ assetId: "a", value: 4200 }] }),
    );

    // The next opening, left before its end, saves nothing more.
    await view.rerender(
      <ReconcileAccountsSheet {...props} isVisible={false} />,
    );
    await view.rerender(<ReconcileAccountsSheet {...props} />);
    await fireEvent.press(view.getByLabelText("scrim"));
    expect(mockFollow.mutate).toHaveBeenCalledTimes(1);
  });

  it("writes nothing there when the sheet is left before the end", async () => {
    offer(linked(account("a", true)));
    const view = await renderSheet().view;
    await fireEvent.changeText(view.getByLabelText(BALANCE), "1000");
    await fireEvent.press(view.getByLabelText("scrim"));
    expect(mockFollow.mutate).not.toHaveBeenCalled();
  });
});

it("walks back one step at a time from the Android back action, then leaves", async () => {
  const { props, view: pending } = renderSheet();
  const view = await pending;
  await fireEvent.changeText(view.getByLabelText(AMOUNT), "1500");
  await fireEvent.press(view.getByText("home.reconcile.accounts.compare"));
  expect(view.getByText(STEP_2)).toBeTruthy();

  await fireEvent.press(view.getByLabelText("android-back"));
  expect(view.getByLabelText(AMOUNT).props.value).toBe("1500");
  expect(props.onDismiss).not.toHaveBeenCalled();

  await fireEvent.press(view.getByLabelText("android-back"));
  expect(props.onDismiss).toHaveBeenCalledTimes(1);
  expect(mockCreate.mutate).not.toHaveBeenCalled();
});

it("dismisses from the scrim without changing step, and forgets what was typed", async () => {
  const { props, view: pending } = renderSheet();
  const view = await pending;
  await fireEvent.changeText(view.getByLabelText(AMOUNT), "1500");
  await fireEvent.press(view.getByText("home.reconcile.accounts.compare"));

  await fireEvent.press(view.getByLabelText("scrim"));

  expect(props.onDismiss).toHaveBeenCalledTimes(1);
  expect(view.getByLabelText(AMOUNT).props.value).toBe("");
  expect(mockCreate.mutate).not.toHaveBeenCalled();
});

it("adds free rows, totals « J'ai » minus « Je dois » live and keeps an overdraft", async () => {
  const { view: pending } = renderSheet();
  const view = await pending;
  await fireEvent.changeText(view.getByLabelText(AMOUNT), "1000");
  expect(view.getByText("home.reconcile.accounts.cardHelp")).toBeTruthy();

  // The card help adds a « Je dois » row.
  await fireEvent.press(view.getByText("home.reconcile.accounts.addOwe"));
  expect(view.queryByText("home.reconcile.accounts.cardHelp")).toBeNull();
  await fireEvent.changeText(
    view.getAllByLabelText("home.reconcile.accounts.accountName")[1],
    "Carte",
  );
  await fireEvent.changeText(view.getAllByLabelText(AMOUNT)[1], "300");
  expect(view.getByTestId("reconcile-total")).toHaveTextContent(/700\.00/);
  expect(
    view.getByText(/accounts\.breakdown:1’000\.00 CHF\|300\.00 CHF/),
  ).toBeTruthy();

  // The side control moves a row from one side to the other.
  await fireEvent.press(view.getAllByText("home.reconcile.accounts.owe")[0]);
  expect(view.getByTestId("reconcile-total")).toHaveTextContent(/-1’300\.00/);

  await fireEvent.press(
    view.getByLabelText("home.reconcile.accounts.remove:Carte"),
  );
  expect(view.getAllByLabelText(AMOUNT)).toHaveLength(1);
});

it("remembers the free rows by name and side when Comparer is pressed, never their amounts", async () => {
  const { view: pending } = renderSheet();
  const view = await pending;
  await fireEvent.changeText(
    view.getByLabelText("home.reconcile.accounts.accountName"),
    "Revolut",
  );
  await fireEvent.changeText(view.getByLabelText(AMOUNT), "1000");
  expect(readFreeAccounts()).toEqual([]);

  await fireEvent.press(view.getByText("home.reconcile.accounts.compare"));

  expect(readFreeAccounts()).toEqual([{ name: "Revolut", side: "own" }]);
});

it("brings what was typed back after the sheet is lost to the auto-lock", async () => {
  const first = await renderSheet().view;
  await fireEvent.changeText(
    first.getByLabelText("home.reconcile.accounts.accountName"),
    "Revolut",
  );
  await fireEvent.changeText(first.getByLabelText(AMOUNT), "1000");
  // The lock drops the screen tree: the sheet unmounts without dismissing.
  await first.unmount();

  const view = await renderSheet().view;
  expect(view.getByLabelText(AMOUNT).props.value).toBe("1000");
  expect(
    view.getByLabelText("home.reconcile.accounts.accountName").props.value,
  ).toBe("Revolut");
});

describe("a drafted Mon patrimoine row while the read is unavailable", () => {
  const drafted = [
    {
      id: 0,
      label: "Compte a",
      amountText: "1500",
      side: "own" as const,
      account: { kind: "asset" as const, id: "a" },
    },
  ];

  it("waits while the read is pending", async () => {
    keepReconcileDraft("budget-1", drafted);
    offer(undefined);
    const view = await renderSheet().view;
    expect(view.getByTestId("reconcile-loading")).toBeTruthy();
  });

  it("stays linked, and its name is never remembered, when the read fails with the flag on", async () => {
    keepReconcileDraft("budget-1", drafted);
    // Flag on, nothing came back: a network error.
    offer(undefined);
    mockNetWorth.isFetching = false;
    const view = await renderSheet().view;

    expect(view.getByText("Compte a")).toBeTruthy();
    expect(
      view.queryByLabelText("home.reconcile.accounts.accountName"),
    ).toBeNull();
    await fireEvent.press(view.getByText("home.reconcile.accounts.compare"));
    // The press went through: an inactive « Comparer » would leave the memory empty too.
    expect(view.getByText(STEP_2)).toBeTruthy();
    expect(readFreeAccounts()).toEqual([]);
  });

  it("stays linked with the flag off", async () => {
    keepReconcileDraft("budget-1", drafted);
    offer(null);
    const view = await renderSheet().view;
    expect(view.getByText("Compte a")).toBeTruthy();
  });
});

it("refuses an unreadable amount even beside a valid one", async () => {
  const { view: pending } = renderSheet();
  const view = await pending;
  await fireEvent.changeText(view.getByLabelText(AMOUNT), "1000");
  await fireEvent.press(view.getByText("home.reconcile.accounts.addAccount"));
  await fireEvent.press(view.getByTestId("reconcile-add-own"));
  const second = view.getAllByLabelText(AMOUNT)[1];
  await fireEvent.changeText(second, "12abc");
  await fireEvent(second, "blur");

  expect(view.getByText("home.reconcile.accounts.invalidAmount")).toBeTruthy();
  await fireEvent.press(view.getByText("home.reconcile.accounts.compare"));
  expect(view.queryByText(STEP_2)).toBeNull();
});

describe("step 2", () => {
  const STAMP = "2026-11-18T10:00:00.000Z";
  const essence: Transaction = {
    id: "t-essence",
    budgetId: "budget-1",
    budgetLineId: null,
    name: "Essence",
    amount: 60,
    kind: "expense",
    transactionDate: STAMP,
    checkedAt: null,
    createdAt: STAMP,
    updatedAt: STAMP,
  };
  // An income cannot explain money missing on the accounts: it stays for « Voir les autres ».
  const refund: Transaction = {
    ...essence,
    id: "t-refund",
    name: "Remboursement",
    amount: 30,
    kind: "income",
  };
  // Last month's, unchecked: the context counts it once checked.
  const pharmacie: ReconciliationContext["priorItems"][number] = {
    id: "t-pharmacie",
    source: "transaction",
    budgetId: "budget-0",
    name: "Pharmacie",
    amount: 40,
    kind: "expense",
    monthsAgo: 1,
    effect: -40,
  };
  const PULPE = { realizedBalance: 1050 };

  function deferredCheck(toggle = mockToggle) {
    let settle: (isKept: boolean) => void = () => undefined;
    toggle.mutateAsync.mockImplementationOnce(
      () =>
        new Promise<void>((resolve, reject) => {
          settle = (isKept) => (isKept ? resolve() : reject(new Error("no")));
        }),
    );
    return (isKept: boolean) => act(() => settle(isKept));
  }

  it("reads the context afresh on each « Comparer » and waits for it", async () => {
    mockContext.data = undefined;
    const view = await renderSheet(PULPE).view;
    await reachVerdict(view, "950");

    expect(forgetReconciliationContext).toHaveBeenCalledWith("budget-1");
    expect(view.getByTestId("reconcile-loading")).toBeTruthy();
    expect(view.queryByText(NOTE_EXPENSE)).toBeNull();

    await fireEvent.press(view.getByLabelText("android-back"));
    await fireEvent.press(view.getByText("home.reconcile.accounts.compare"));
    expect(forgetReconciliationContext).toHaveBeenCalledTimes(2);
  });

  it("shows the error with [Réessayer], offers no write, and back keeps the amounts", async () => {
    Object.assign(mockContext, { isError: true });
    const view = await renderSheet(PULPE).view;
    await reachVerdict(view, "950");

    expect(view.getByText("home.reconcile.compare.loadError")).toBeTruthy();
    expect(view.queryByText(NOTE_EXPENSE)).toBeNull();
    expect(view.queryByText("home.reconcile.compare.finish")).toBeNull();
    await fireEvent.press(view.getByText("common.retry"));
    expect(mockContext.refetch).toHaveBeenCalledTimes(1);

    await fireEvent.press(view.getByLabelText("android-back"));
    expect(view.getByLabelText(AMOUNT).props.value).toBe("950");
    expect(mockCreate.mutate).not.toHaveBeenCalled();
  });

  it("checks each stored item by id, holds every exit until its re-read lands, then completes once", async () => {
    mockContext.data = { ...CONTEXT, priorItems: [pharmacie] };
    const { props, view: pending } = renderSheet(PULPE, [essence, refund]);
    const view = await pending;
    await reachVerdict(view, "950");
    expect(view.getByText("home.reconcile.compare.leadExpense")).toBeTruthy();
    expect(view.getByText("home.reconcile.compare.othersOne:1")).toBeTruthy();

    const settle = deferredCheck();
    await fireEvent.press(view.getByText("Essence"));
    expect(mockToggle.mutateAsync).toHaveBeenCalledWith({
      source: "transaction",
      sourceId: "t-essence",
    });
    expect(view.getByText("busy:true")).toBeTruthy();
    await fireEvent.press(view.getByLabelText("android-back"));
    await fireEvent.press(view.getByLabelText("scrim"));
    expect(props.onDismiss).not.toHaveBeenCalled();
    expect(view.getByText(STEP_2)).toBeTruthy();

    // The month comes back with Essence checked, then the check settles.
    const checkedMonth = {
      ...props.month,
      realized: { ...props.month.realized, realizedBalance: 990 },
      transactions: [{ ...essence, checkedAt: STAMP }, refund],
    };
    await view.rerender(
      <ReconcileAccountsSheet {...props} month={checkedMonth} />,
    );
    await settle(true);

    expect(view.getByTestId("reconcile-compared-before")).toBeTruthy();
    expect(
      view.getByText("home.reconcile.compare.found:60.00 CHF"),
    ).toBeTruthy();
    expect(view.getByText("busy:false")).toBeTruthy();

    // Pharmacie is last month's: answered by the server, then read back with the context.
    const settlePrior = deferredCheck(mockTogglePrior);
    let landReread: () => void = () => undefined;
    mockChecksSettled.mockImplementationOnce(
      () => new Promise<void>((resolve) => (landReread = resolve)),
    );
    await fireEvent.press(view.getByText("Pharmacie"));
    expect(mockTogglePrior.mutateAsync).toHaveBeenCalledWith({
      source: "transaction",
      sourceId: "t-pharmacie",
    });
    await settlePrior(true);
    // Still listed until the context lands: a second tap would uncheck it.
    expect(view.getByText("busy:true")).toBeTruthy();
    await fireEvent.press(view.getByText("Pharmacie"));
    expect(mockTogglePrior.mutateAsync).toHaveBeenCalledTimes(1);
    expect(mockToggle.mutateAsync).toHaveBeenCalledTimes(1);

    mockContext.data = { ...CONTEXT, priorCorrection: -40 };
    await view.rerender(
      <ReconcileAccountsSheet {...props} month={checkedMonth} />,
    );
    await act(() => landReread());

    expect(view.getByText("home.reconcile.compare.matched")).toBeTruthy();
    expect(view.getByText("busy:false")).toBeTruthy();
    await fireEvent.press(view.getByText("home.reconcile.compare.finish"));
    expect(captureEvent).toHaveBeenCalledTimes(1);
    expect(captureEvent).toHaveBeenCalledWith(
      "account_reconciliation_completed",
      { adjustment_kind: "none" },
    );
    expect(mockCompleteReconciliation).toHaveBeenCalledTimes(1);
    expect(props.onDismiss).toHaveBeenCalledTimes(1);
  });

  it("says so when a check is refused, and strikes nothing through", async () => {
    const view = await renderSheet(PULPE, [essence]).view;
    await reachVerdict(view, "950");
    const settle = deferredCheck();
    await fireEvent.press(view.getByText("Essence"));
    await settle(false);

    expect(view.getByText("home.checking.pointFailure")).toBeTruthy();
    expect(view.queryByTestId("reconcile-compared-before")).toBeNull();
    expect(view.getByText("Essence")).toBeTruthy();
  });

  it("goes from « Aucune dépense ne correspond » to one entry with a stable id, completed once", async () => {
    const { props, view: pending } = renderSheet(PULPE, [essence]);
    const view = await pending;
    await reachVerdict(view, "930");
    await fireEvent.press(
      view.getByText("home.reconcile.compare.noExpenseMatches"),
    );
    expect(
      view.getByText(
        "home.reconcile.compare.availableNote:900.00 CHF|780.00 CHF",
      ),
    ).toBeTruthy();

    await fireEvent.press(view.getByText(NOTE_EXPENSE));
    // A second tap landing before the pending state renders writes nothing.
    await fireEvent.press(view.getByText(NOTE_EXPENSE));
    expect(mockCreate.mutate).toHaveBeenCalledTimes(1);
    const [payload, first] = mockCreate.mutate.mock.calls[0] as [
      Record<string, unknown>,
      { onSettled: () => void },
    ];
    expect(payload).toEqual({
      id: expect.any(String),
      budgetId: "budget-1",
      name: "home.reconcile.compare.entryName",
      amount: 120,
      kind: "expense",
      transactionDate: expect.any(String),
      checkedAt: expect.any(String),
    });

    // Refused: the screen stays, and the retry replays the same write, id included.
    Object.assign(mockCreate, { isError: true });
    await act(() => first.onSettled());
    await view.rerender(<ReconcileAccountsSheet {...props} />);
    await fireEvent.press(view.getByText(NOTE_EXPENSE));
    const [replayed, retry] = mockCreate.mutate.mock.calls[1] as [
      unknown,
      { onSuccess: () => void },
    ];
    expect(replayed).toBe(payload);
    expect(captureEvent).not.toHaveBeenCalled();

    await act(() => retry.onSuccess());
    expect(captureEvent).toHaveBeenCalledTimes(1);
    expect(captureEvent).toHaveBeenCalledWith(
      "account_reconciliation_completed",
      { adjustment_kind: "expense" },
    );
    expect(mockCompleteReconciliation).toHaveBeenCalledTimes(1);
    expect(props.onRecorded).toHaveBeenCalledTimes(1);
  });

  it("offers a small gap as a note of its own amount", async () => {
    const view = await renderSheet(PULPE).view;
    await reachVerdict(view, "1047.60");
    expect(view.getByTestId("reconcile-small-gap")).toBeTruthy();
    expect(
      view.getByText("home.reconcile.compare.noteExpense:2.40 CHF"),
    ).toBeTruthy();
    expect(
      view.getByText(
        "home.reconcile.compare.availableNote:900.00 CHF|897.60 CHF",
      ),
    ).toBeTruthy();
  });

  it("finishes a match once, writing nothing", async () => {
    const { props, view: pending } = renderSheet({
      realizedBalance: 0.1 + 0.2,
    });
    const view = await pending;
    await reachVerdict(view, "0.30");
    expect(view.getByText("home.reconcile.compare.matched")).toBeTruthy();

    // A double tap: both presses land on the same render.
    const finish = view.getByText("home.reconcile.compare.finish");
    await act(async () => {
      await Promise.all([fireEvent.press(finish), fireEvent.press(finish)]);
    });

    expect(mockCreate.mutate).not.toHaveBeenCalled();
    expect(captureEvent).toHaveBeenCalledTimes(1);
    expect(captureEvent).toHaveBeenCalledWith(
      "account_reconciliation_completed",
      { adjustment_kind: "none" },
    );
    expect(mockCompleteReconciliation).toHaveBeenCalledTimes(1);
    expect(props.onDismiss).toHaveBeenCalledTimes(1);
  });

  it("takes « Je dois » out of the comparison and compares again", async () => {
    const view = await renderSheet(PULPE, [essence]).view;
    await fireEvent.press(view.getByText("home.reconcile.accounts.addOwe"));
    const [own, owe] = view.getAllByLabelText(AMOUNT);
    await fireEvent.changeText(own, "1000");
    await fireEvent.changeText(owe, "100");
    await fireEvent.press(view.getByText("home.reconcile.accounts.compare"));
    expect(view.getByText("home.reconcile.compare.leadCard")).toBeTruthy();

    await fireEvent.press(
      view.getByText("home.reconcile.compare.removeOwe:100.00 CHF"),
    );

    expect(view.getByText(STEP_2)).toBeTruthy();
    expect(view.queryByTestId("reconcile-owe-box")).toBeNull();
    expect(view.queryByText("home.reconcile.compare.leadCard")).toBeNull();
  });

  it("opens « À pointer » from « Voir les autres »", async () => {
    const { props, view: pending } = renderSheet(PULPE, [essence, refund]);
    const view = await pending;
    await reachVerdict(view, "950");
    await fireEvent.press(view.getByText("home.reconcile.compare.othersOne:1"));
    expect(props.onViewItemsToCheck).toHaveBeenCalledTimes(1);
    expect(captureEvent).not.toHaveBeenCalled();
  });
});

it("closes, writing nothing, once the screen no longer holds the month it opened on", async () => {
  const { props, view: pending } = renderSheet();
  const view = await pending;
  await reachVerdict(view, "1500");

  await view.rerender(<ReconcileAccountsSheet {...props} month={null} />);

  expect(props.onDismiss).toHaveBeenCalledTimes(1);
  expect(mockCreate.mutate).not.toHaveBeenCalled();
  expect(captureEvent).not.toHaveBeenCalled();
  expect(view.getByLabelText(AMOUNT).props.value).toBe("");
});

it("lets a write already out settle on its own month, then closes and hands the refusal over", async () => {
  const { props, view: pending } = renderSheet({ realizedBalance: 1600 });
  const view = await pending;
  await reachVerdict(view, "1500");
  await fireEvent.press(view.getByText(NOTE_EXPENSE));
  const [payload, callbacks] = mockCreate.mutate.mock.calls[0] as [
    Record<string, unknown>,
    { onSettled: () => void },
  ];
  expect(payload).toEqual(
    expect.objectContaining({ budgetId: "budget-1", amount: 100 }),
  );

  Object.assign(mockCreate, { isPending: true });
  await view.rerender(<ReconcileAccountsSheet {...props} month={null} />);
  expect(props.onDismiss).not.toHaveBeenCalled();

  Object.assign(mockCreate, { isPending: false, isError: true });
  await act(() => callbacks.onSettled());
  await view.rerender(<ReconcileAccountsSheet {...props} month={null} />);

  expect(props.onDismiss).toHaveBeenCalledTimes(1);
  expect(props.onRecordFailed).toHaveBeenCalledTimes(1);
  expect(props.onDismiss.mock.invocationCallOrder[0]).toBeLessThan(
    props.onRecordFailed.mock.invocationCallOrder[0],
  );
  expect(captureEvent).not.toHaveBeenCalled();
});

it("completes once when a write already out succeeds after the month went away", async () => {
  const { props, view: pending } = renderSheet({ realizedBalance: 1600 });
  const view = await pending;
  await reachVerdict(view, "1500");
  await fireEvent.press(view.getByText(NOTE_EXPENSE));
  const [, callbacks] = mockCreate.mutate.mock.calls[0] as [
    unknown,
    { onSuccess: () => void; onSettled: () => void },
  ];

  Object.assign(mockCreate, { isPending: true });
  await view.rerender(<ReconcileAccountsSheet {...props} month={null} />);
  Object.assign(mockCreate, { isPending: false });
  await act(() => {
    callbacks.onSuccess();
    callbacks.onSettled();
  });
  await view.rerender(<ReconcileAccountsSheet {...props} month={null} />);

  expect(captureEvent).toHaveBeenCalledTimes(1);
  expect(mockCompleteReconciliation).toHaveBeenCalledTimes(1);
  expect(props.onRecorded).toHaveBeenCalledTimes(1);
  expect(props.onRecordFailed).not.toHaveBeenCalled();
});
