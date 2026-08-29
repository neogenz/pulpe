import { act, fireEvent, render } from "@testing-library/react-native";
import type { TemplateLine } from "pulpe-shared";

import { hapticSuccess } from "@/core/ui/haptics";

import { TemplateLineSheet } from "./template-line-sheet";

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
  useTranslation: () => ({ t: (key: string) => key }),
}));
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
    SegmentedButtons: ({
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
    Text,
    TextInput: ({
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
    useTheme: () => ({ colors: { onSurfaceVariant: "gray" } }),
  };
});

const baseProps = {
  isVisible: true,
  onDismiss: jest.fn(),
  templateId: "template-1",
  currency: "CHF" as const,
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
} as TemplateLine;

beforeEach(() => {
  jest.clearAllMocks();
  for (const mutation of [mockCreate, mockUpdate, mockBulk])
    Object.assign(mutation, { isPending: false, isError: false });
});

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
    onSuccess: () => void;
  };
  await act(() => callbacks.onSuccess());
  expect(hapticSuccess).toHaveBeenCalledTimes(1);
  expect(baseProps.onSaved).toHaveBeenCalledTimes(1);
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
