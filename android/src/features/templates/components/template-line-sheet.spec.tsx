import { act, fireEvent, render } from "@testing-library/react-native";
import type { TemplateLine } from "pulpe-shared";

import { hapticSuccess } from "@/core/ui/haptics";
import {
  COMPTE_COURANT,
  contractAssets,
  LIVRET,
  REVOLUT,
} from "@/core/testing/net-worth-accounts";

import { TemplateLineSheet } from "./template-line-sheet";

let mockAccounts: {
  isFlagOn: boolean;
  defaultAccountId: string | null;
  assets: ReturnType<typeof contractAssets>;
} = { isFlagOn: false, defaultAccountId: null, assets: contractAssets() };
jest.mock("@/core/observability/feature-flags", () => ({
  useFeatureFlag: () => mockAccounts.isFlagOn,
}));
jest.mock("@/features/net-worth/net-worth-queries", () => ({
  useNetWorth: () => ({ data: { assets: mockAccounts.assets } }),
}));
jest.mock("@/core/user-settings/user-settings-queries", () => ({
  useUserSettings: () => ({
    data: { defaultAccountId: mockAccounts.defaultAccountId },
  }),
}));
// Paper is mocked below: the list stands in with one pressable row per choice.
jest.mock("@/features/net-worth/components/account-choice-list", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    AccountChoiceList: ({
      choices,
      value,
      onChange,
    }: {
      choices: { own: { id: string; name: string }[]; owe: typeof choices.own };
      value: string | null;
      onChange: (id: string | null) => void;
    }) =>
      [
        { id: null, name: "netWorth.account.none" },
        ...choices.own,
        ...choices.owe,
      ].map((choice) => (
        <Pressable
          key={choice.id ?? "none"}
          testID={`account-${choice.id ?? "none"}`}
          onPress={() => onChange(choice.id)}
          accessibilityState={{ checked: value === choice.id }}
        >
          <Text>{choice.name}</Text>
        </Pressable>
      )),
  };
});

const mockCreate = {
  mutate: jest.fn(),
  reset: jest.fn(),
  isPending: false,
  isError: false,
};
const mockUpdate = {
  mutate: jest.fn(),
  reset: jest.fn(),
  isPending: false,
  isError: false,
};
const mockBulk = {
  mutate: jest.fn(),
  reset: jest.fn(),
  isPending: false,
  isError: false,
};
const mockGoals = { data: [{ id: "goal-1", name: "Voyage" }] };

jest.mock("../template-queries", () => ({
  useBulkTemplateLines: () => mockBulk,
  useCreateTemplateLine: () => mockCreate,
  useUpdateTemplateLine: () => mockUpdate,
}));
jest.mock("@/features/savings-goals/goals-queries", () => ({
  useSavingsGoals: () => mockGoals,
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options === undefined
        ? key
        : `${key}:${Object.values(options).join("|")}`,
  }),
}));
jest.mock("@/core/ui/segmented-picker", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    SegmentedPicker: ({
      buttons,
      onValueChange,
    }: {
      buttons: { value: string; label: string }[];
      onValueChange: (value: string) => void;
    }) => (
      <View>
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
jest.mock("@/core/ui/haptics", () => ({ hapticSuccess: jest.fn() }));
jest.mock("@/core/ui/vocabulary", () => ({
  kindOptions: () => [
    { value: "expense", label: "kind:expense" },
    { value: "saving", label: "kind:saving" },
  ],
  recurrenceOptions: () => [
    { value: "fixed", label: "recurrence:fixed" },
    { value: "one_off", label: "recurrence:one_off" },
  ],
}));
jest.mock("@/core/ui/theme", () => ({ SPACING: { xs: 4 } }));
jest.mock("@/core/ui/ripple", () => ({ useRipple: () => ({}) }));
jest.mock("@/core/ui/field-error", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    FieldError: ({ children }: { children: React.ReactNode }) => (
      <Text>{children}</Text>
    ),
  };
});
jest.mock("@/core/ui/amount-field", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    AmountField: ({ onChange }: { onChange: (value: number) => void }) => (
      <Pressable accessibilityLabel="set-amount" onPress={() => onChange(250)}>
        <Text>250</Text>
      </Pressable>
    ),
  };
});
jest.mock("@/core/ui/sheet", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    FormModal: ({
      isVisible,
      title,
      children,
      footer,
      onDismiss,
      isBusy,
    }: {
      isVisible: boolean;
      title: string;
      children: React.ReactNode;
      footer: React.ReactNode;
      onDismiss: () => void;
      isBusy: boolean;
    }) =>
      isVisible ? (
        <View>
          <Text>{title}</Text>
          <Text>{`busy:${isBusy}`}</Text>
          {children}
          {footer}
          <Pressable
            accessibilityLabel="dismiss-form"
            disabled={isBusy}
            onPress={onDismiss}
          />
        </View>
      ) : null,
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
    }: {
      children: React.ReactNode;
      onPress: () => void;
      disabled?: boolean;
    }) => (
      <Pressable onPress={onPress} disabled={disabled}>
        <Text>{children}</Text>
      </Pressable>
    ),
    Chip: ({
      children,
      onPress,
      selected,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      selected: boolean;
    }) => (
      <Pressable onPress={onPress} accessibilityState={{ selected }}>
        <Text>{children}</Text>
      </Pressable>
    ),
    Dialog: Object.assign(
      ({
        visible,
        children,
      }: {
        visible: boolean;
        children: React.ReactNode;
      }) => (visible ? <View>{children}</View> : null),
      {
        Title: ({ children }: { children: React.ReactNode }) => (
          <Text>{children}</Text>
        ),
        Content: View,
        Actions: View,
      },
    ),
    Portal: ({ children }: { children: React.ReactNode }) => children,
    Text,
    TextInput: Object.assign(
      ({
        label,
        value,
        onChangeText,
      }: {
        label: string;
        value: string;
        onChangeText: (value: string) => void;
      }) => (
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
        />
      ),
      { Icon: () => null },
    ),
    useTheme: () => ({ colors: { onSurfaceVariant: "gray" } }),
  };
});

const baseProps = {
  isVisible: true,
  onDismiss: jest.fn(),
  templateId: "template-1",
  currency: "CHF" as const,
  templateName: "Mois standard",
  propagationCount: 0,
  onSaved: jest.fn(),
};
const existingLine = {
  id: "line-1",
  templateId: "template-1",
  name: "Ancien nom",
  amount: 100,
  kind: "expense",
  recurrence: "fixed",
  savingsGoalId: null,
  assetId: "asset-1",
} as TemplateLine;

beforeEach(() => {
  jest.clearAllMocks();
  for (const mutation of [mockCreate, mockUpdate, mockBulk])
    Object.assign(mutation, { isPending: false, isError: false });
  mockAccounts = {
    isFlagOn: false,
    defaultAccountId: null,
    assets: contractAssets(),
  };
});

/** « Compte » is one field; its list opens in a sheet over the form. */
const openAccounts = (view: Awaited<ReturnType<typeof render>>) =>
  fireEvent.press(view.getByTestId("account-field"));

async function editFields(
  view: Awaited<ReturnType<typeof render>>,
  name = "Voyage mensuel",
) {
  await fireEvent.press(view.getByLabelText("set-amount"));
  await fireEvent.changeText(view.getByLabelText("templates.form.name"), name);
}

it("keeps an invalid creation local then creates from explicit fields", async () => {
  const view = await render(<TemplateLineSheet {...baseProps} />);
  await fireEvent.press(view.getByText("templates.lines.add"));
  expect(mockCreate.mutate).not.toHaveBeenCalled();

  await editFields(view);
  await fireEvent.press(view.getByText("kind:saving"));
  await fireEvent.press(view.getByText("Voyage"));
  await fireEvent.press(view.getByText("recurrence:one_off"));
  await fireEvent.press(view.getByText("templates.lines.add"));
  expect(mockCreate.mutate).toHaveBeenCalledWith(
    {
      templateId: "template-1",
      name: "Voyage mensuel",
      amount: 250,
      kind: "saving",
      recurrence: "one_off",
      description: "",
      savingsGoalId: "goal-1",
    },
    expect.any(Object),
  );
});

it("saves an edit directly when no generated budget can be propagated", async () => {
  const view = await render(
    <TemplateLineSheet {...baseProps} line={existingLine} />,
  );
  await editFields(view, "Nouveau nom");
  await fireEvent.press(view.getByText("templates.lines.save"));

  expect(mockUpdate.mutate).toHaveBeenCalledWith(
    {
      templateId: "template-1",
      lineId: "line-1",
      changes: {
        name: "Nouveau nom",
        amount: 250,
        kind: "expense",
        recurrence: "fixed",
        savingsGoalId: null,
      },
    },
    expect.any(Object),
  );
});

it("waits for an explicit template-only choice before updating", async () => {
  const view = await render(
    <TemplateLineSheet
      {...baseProps}
      line={existingLine}
      propagationCount={3}
    />,
  );
  await editFields(view);
  await fireEvent.press(view.getByText("templates.lines.save"));
  expect(view.getByText("templates.lines.propagationTitle")).toBeTruthy();
  expect(mockUpdate.mutate).not.toHaveBeenCalled();
  expect(mockBulk.mutate).not.toHaveBeenCalled();

  await fireEvent.press(view.getByText("templates.lines.templateOnly"));
  expect(mockUpdate.mutate).toHaveBeenCalledTimes(1);
});

it("propagates exact edited values only after explicit confirmation", async () => {
  const view = await render(
    <TemplateLineSheet
      {...baseProps}
      line={existingLine}
      propagationCount={3}
    />,
  );
  await editFields(view);
  await fireEvent.press(view.getByText("templates.lines.save"));
  await fireEvent.press(view.getByText("templates.lines.apply"));

  expect(mockBulk.mutate).toHaveBeenCalledWith(
    {
      templateId: "template-1",
      operations: {
        create: [],
        delete: [],
        update: [
          {
            id: "line-1",
            name: "Voyage mensuel",
            amount: 250,
            kind: "expense",
            recurrence: "fixed",
            savingsGoalId: null,
          },
        ],
        propagateToBudgets: true,
      },
    },
    expect.any(Object),
  );
  const callbacks = mockBulk.mutate.mock.calls[0][1] as {
    onSuccess: (result: unknown) => void;
  };
  // The server's count wins over the 3 the sheet was told to expect.
  await act(() =>
    callbacks.onSuccess({ propagation: { affectedBudgetsCount: 2 } }),
  );
  expect(hapticSuccess).toHaveBeenCalledTimes(1);
  expect(baseProps.onSaved).toHaveBeenCalledWith({ updatedBudgets: 2 });
});

it("says so when applying to the budgets fails, with the values kept", async () => {
  const view = await render(
    <TemplateLineSheet
      {...baseProps}
      line={existingLine}
      propagationCount={3}
    />,
  );
  await editFields(view);
  await fireEvent.press(view.getByText("templates.lines.save"));
  await fireEvent.press(view.getByText("templates.lines.apply"));
  expect(mockUpdate.reset).toHaveBeenCalled();

  mockBulk.isError = true;
  const callbacks = mockBulk.mutate.mock.calls[0][1] as {
    onError: () => void;
  };
  await act(() => callbacks.onError());

  expect(view.queryByText("templates.lines.propagationTitle")).toBeNull();
  expect(view.getByText("templates.lines.error")).toBeTruthy();
  expect(view.getByLabelText("templates.form.name").props.value).toBe(
    "Voyage mensuel",
  );
  expect(baseProps.onSaved).not.toHaveBeenCalled();
});

it("keeps rejected values editable and blocks dismissal while pending", async () => {
  Object.assign(mockUpdate, { isError: true, isPending: true });
  const view = await render(
    <TemplateLineSheet {...baseProps} line={existingLine} />,
  );
  await fireEvent.changeText(
    view.getByLabelText("templates.form.name"),
    "À réessayer",
  );
  expect(view.getByText("templates.lines.error")).toBeTruthy();
  expect(view.getByLabelText("templates.form.name").props.value).toBe(
    "À réessayer",
  );
  await fireEvent.press(view.getByLabelText("dismiss-form"));
  expect(baseProps.onDismiss).not.toHaveBeenCalled();
});

it("names the current month in the propagation step", async () => {
  const view = await render(
    <TemplateLineSheet
      {...baseProps}
      line={existingLine}
      propagationCount={3}
      propagationMonth="novembre"
    />,
  );
  await editFields(view);
  await fireEvent.press(view.getByText("templates.lines.save"));

  expect(
    view.getByText("templates.lines.propagationTitleMonth:novembre"),
  ).toBeTruthy();
  expect(view.getByText("templates.lines.applyMonth:novembre")).toBeTruthy();
});

it("captions what « Quand ? » means for the model's months", async () => {
  const view = await render(<TemplateLineSheet {...baseProps} />);
  expect(
    view.getByText("templates.lines.whenFixed:Mois standard"),
  ).toBeTruthy();

  await fireEvent.press(view.getByText("recurrence:one_off"));
  expect(
    view.getByText("templates.lines.whenOneOff:Mois standard"),
  ).toBeTruthy();
});

describe("« Compte » (PUL-378)", () => {
  beforeEach(() => {
    mockAccounts = {
      isFlagOn: true,
      defaultAccountId: null,
      assets: contractAssets(),
    };
  });

  it("CA1 lists the elements, and CA2 drops the field with the flag off", async () => {
    const view = await render(<TemplateLineSheet {...baseProps} />);
    await openAccounts(view);
    for (const name of ["Compte courant", "Revolut", "Livret", "Leasing"]) {
      expect(view.getByText(name)).toBeTruthy();
    }

    mockAccounts = { ...mockAccounts, isFlagOn: false };
    const off = await render(<TemplateLineSheet {...baseProps} />);
    expect(off.queryByTestId("account-field")).toBeNull();
  });

  it("CA2 sends no account with the flag off", async () => {
    mockAccounts = { ...mockAccounts, isFlagOn: false };
    const view = await render(<TemplateLineSheet {...baseProps} />);
    await editFields(view);
    await fireEvent.press(view.getByText("templates.lines.add"));

    expect(mockCreate.mutate.mock.calls[0][0]).not.toHaveProperty("accountId");
  });

  it("CA29 prefills the default account on a new line, CA3 sends null without one", async () => {
    mockAccounts = { ...mockAccounts, defaultAccountId: COMPTE_COURANT };
    const view = await render(<TemplateLineSheet {...baseProps} />);
    await editFields(view);
    await fireEvent.press(view.getByText("templates.lines.add"));
    expect(mockCreate.mutate.mock.calls[0][0]).toMatchObject({
      accountId: COMPTE_COURANT,
    });

    await openAccounts(view);
    await fireEvent.press(view.getByTestId("account-none"));
    await fireEvent.press(view.getByText("templates.lines.add"));
    expect(mockCreate.mutate.mock.calls[1][0]).toMatchObject({
      accountId: null,
    });
  });

  it("CA26 omits the account of an edit that does not touch it", async () => {
    const view = await render(
      <TemplateLineSheet
        {...baseProps}
        line={{ ...existingLine, accountId: REVOLUT } as TemplateLine}
      />,
    );
    await editFields(view, "Nouveau nom");
    await fireEvent.press(view.getByText("templates.lines.save"));

    expect(mockUpdate.mutate.mock.calls[0][0].changes).not.toHaveProperty(
      "accountId",
    );
  });

  it("CA22 sends the new account to the model, and to the budgets it propagates to", async () => {
    const line = { ...existingLine, accountId: REVOLUT } as TemplateLine;
    const view = await render(
      <TemplateLineSheet {...baseProps} line={line} propagationCount={3} />,
    );
    await openAccounts(view);
    await fireEvent.press(view.getByText("Livret"));
    await fireEvent.press(view.getByText("templates.lines.save"));
    await fireEvent.press(view.getByText("templates.lines.templateOnly"));
    expect(mockUpdate.mutate.mock.calls[0][0].changes).toMatchObject({
      accountId: LIVRET,
    });

    await fireEvent.press(view.getByText("templates.lines.apply"));
    expect(mockBulk.mutate.mock.calls[0][0].operations.update[0]).toMatchObject(
      { accountId: LIVRET },
    );
  });

  it("CA25 blocks saving the same element as account and as link", async () => {
    const savings = {
      ...existingLine,
      kind: "saving",
      assetId: LIVRET,
    } as TemplateLine;
    const view = await render(
      <TemplateLineSheet {...baseProps} line={savings} />,
    );
    await openAccounts(view);
    await fireEvent.press(view.getByText("Livret"));
    await fireEvent.press(view.getByText("templates.lines.save"));

    expect(mockUpdate.mutate).not.toHaveBeenCalled();
    await openAccounts(view);
    await fireEvent.press(view.getByText("Compte courant"));
    await fireEvent.press(view.getByText("templates.lines.save"));
    expect(mockUpdate.mutate.mock.calls[0][0].changes).toMatchObject({
      accountId: COMPTE_COURANT,
    });
  });
});
