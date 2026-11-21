import { act, render } from "@testing-library/react-native";
import type { Ref } from "react";

import { ReconcileStartingAmountSheet } from "./reconcile-starting-amount-sheet";

jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
const mockFocus = jest.fn();
jest.mock("@/core/ui/amount-field", () => ({
  AmountField: ({ ref }: { ref: Ref<{ focus: () => void }> }) => {
    jest
      .requireActual<typeof import("react")>("react")
      .useImperativeHandle(ref, () => ({ focus: mockFocus }));
    return null;
  },
}));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

it("focuses the amount once the sheet is on screen, so the keyboard opens with it", async () => {
  const view = await render(
    <ReconcileStartingAmountSheet
      isVisible
      amount={3100}
      currency="CHF"
      onDismiss={jest.fn()}
      onSave={jest.fn()}
    />,
  );
  expect(mockFocus).not.toHaveBeenCalled();

  // The native modal's own `onShow`: `fireEvent` would bubble up to the sheet's
  // prop and pass even if the sheet stopped handing it on.
  await act(() => view.getByTestId("form-modal").props.onShow());
  expect(mockFocus).toHaveBeenCalledTimes(1);
});
