import { act, fireEvent, render } from "@testing-library/react-native";
import { TextInput } from "react-native";

import { ReconcileStartingAmountSheet } from "./reconcile-starting-amount-sheet";

jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const SAVE = "home.reconcile.compare.saveStartingAmount";
const RESET = "home.reconcile.compare.resetStartingAmount";
const INVALID = "home.reconcile.accounts.invalidAmount";

function renderSheet(amount: number) {
  const props = { onDismiss: jest.fn(), onSave: jest.fn() };
  const view = render(
    <ReconcileStartingAmountSheet
      isVisible
      amount={amount}
      currency="CHF"
      {...props}
    />,
  );
  return { props, view };
}

it("focuses the amount once the sheet is on screen, so the keyboard opens with it", async () => {
  const focus = jest.spyOn(TextInput.prototype, "focus");
  const view = await renderSheet(3100).view;
  expect(focus).not.toHaveBeenCalled();

  // The native modal's own `onShow`: `fireEvent` would bubble up to the sheet's
  // prop and pass even if the sheet stopped handing it on.
  await act(() => view.getByTestId("form-modal").props.onShow());
  expect(focus).toHaveBeenCalledTimes(1);
  focus.mockRestore();
});

it("keeps a negative amount negative while it is edited", async () => {
  const { props, view: pending } = renderSheet(-500);
  const view = await pending;
  const field = view.getByTestId("reconcile-starting-amount-field");
  expect(field.props.value).toBe("-500");

  await fireEvent.changeText(field, "-5000");
  await fireEvent.press(view.getByText(SAVE));

  expect(props.onSave).toHaveBeenCalledWith(-5000);
});

it("sends nothing when the amount is unchanged: saving only closes", async () => {
  const { props, view: pending } = renderSheet(-500);
  const view = await pending;
  await fireEvent.press(view.getByText(SAVE));

  expect(props.onSave).not.toHaveBeenCalled();
  expect(props.onDismiss).toHaveBeenCalledTimes(1);
});

it("sends nothing when « Remettre à 0 » finds it already at 0", async () => {
  const { props, view: pending } = renderSheet(0);
  const view = await pending;
  await fireEvent.press(view.getByText(RESET));

  expect(props.onSave).not.toHaveBeenCalled();
  expect(props.onDismiss).toHaveBeenCalledTimes(1);
});

it("says why an unreadable amount is refused, and nothing while the field is empty", async () => {
  const view = await renderSheet(3100).view;
  const field = view.getByTestId("reconcile-starting-amount-field");
  await fireEvent.changeText(field, "");
  expect(view.queryByText(INVALID)).toBeNull();

  await fireEvent.changeText(field, "12,345");
  expect(view.getByText(INVALID)).toBeTruthy();
});

it.each(["", "12.", "abc", "1.234"])(
  "cannot save « %s »: empty or unreadable",
  async (typed) => {
    const { props, view: pending } = renderSheet(3100);
    const view = await pending;
    await fireEvent.changeText(
      view.getByTestId("reconcile-starting-amount-field"),
      typed,
    );
    await fireEvent.press(view.getByText(SAVE));

    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.onDismiss).not.toHaveBeenCalled();
  },
);
