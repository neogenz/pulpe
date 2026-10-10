import { fireEvent, render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";

import { TransactionDialog } from "./transaction-dialog";

jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ locale: "fr", t: (key: string) => key }),
}));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
// A host element carrying the props, so the spec can see where the field sits
// and how it is set without loading the real input.
jest.mock("@/core/ui/amount-field", () => {
  const { View } = jest.requireActual("react-native");
  return {
    AmountField: (props: { isProminent?: boolean; autoFocus?: boolean }) => (
      <View
        testID="amount-field"
        isProminent={props.isProminent}
        autoFocus={props.autoFocus}
      />
    ),
  };
});
// Mints ids through the native crypto binding, which no test can load.
jest.mock("../onboarding-transaction", () => ({
  createCustomTransaction: jest.fn(),
}));

/**
 * Paper's centred Dialog had no keyboard handling, and the edge-to-edge window
 * keeps its full height under the IME: "Ajouter" sat under the keys. The form
 * now opens in the shared FormModal, which pins its action above the keyboard.
 */
it("opens in the shared form modal with its action pinned in the footer", async () => {
  const onDismiss = jest.fn();
  const view = await render(
    <PaperProvider>
      <TransactionDialog
        kind="expense"
        currency="CHF"
        editing={null}
        onDismiss={onDismiss}
        onSubmit={jest.fn()}
      />
    </PaperProvider>,
  );

  expect(view.getByTestId("form-modal").props.visible).toBe(true);
  expect(view.getByText("onboarding.transaction.title.expense")).toBeTruthy();
  expect(
    view.getByRole("button", { name: "onboarding.transaction.add" }),
  ).toBeDisabled();

  await fireEvent.press(view.getByLabelText("common.close"));
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

/**
 * Like every form that takes an amount, the dialog leads with it, set large,
 * and opens the keyboard on it; the name follows.
 */
it("leads with the prominent amount, focused, before the name", async () => {
  const view = await render(
    <PaperProvider>
      <TransactionDialog
        kind="expense"
        currency="CHF"
        editing={null}
        onDismiss={jest.fn()}
        onSubmit={jest.fn()}
      />
    </PaperProvider>,
  );

  const amountField = view.getByTestId("amount-field");
  expect(amountField.props.isProminent).toBe(true);
  expect(amountField.props.autoFocus).toBe(true);

  const nameField = view.getByPlaceholderText(
    "onboarding.transaction.placeholder.expense",
  );
  expect(nameField.props.autoFocus).toBeFalsy();

  const tree = JSON.stringify(view.toJSON());
  expect(tree.indexOf('"amount-field"')).toBeLessThan(
    tree.indexOf('"onboarding.transaction.placeholder.expense"'),
  );
});
