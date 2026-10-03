import { fireEvent, render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";

import { QUICK_AMOUNTS, QuickAmountChips } from "./quick-amount-chips";

jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({
    locale: "fr",
    t: (key: string, params?: Record<string, unknown>) =>
      `${key}:${String(params?.amount)}`,
  }),
}));
jest.mock("./haptics", () => ({ hapticSelection: jest.fn() }));

it("offers the four amounts iOS offers, and fills the field with one", async () => {
  const onSelect = jest.fn();
  const view = await render(
    <PaperProvider>
      <QuickAmountChips amount={null} currency="CHF" onSelect={onSelect} />
    </PaperProvider>,
  );

  expect(QUICK_AMOUNTS).toEqual([10, 15, 20, 30]);
  expect(view.getByText("20 CHF")).toBeTruthy();

  await fireEvent.press(view.getByText("20 CHF"));

  expect(onSelect).toHaveBeenCalledWith(20);
});

it("marks the amount the field already holds", async () => {
  const view = await render(
    <PaperProvider>
      <QuickAmountChips amount={15} currency="CHF" onSelect={jest.fn()} />
    </PaperProvider>,
  );

  const selected = view
    .getAllByRole("button")
    .filter((chip) => chip.props.accessibilityState?.selected === true);
  expect(selected).toHaveLength(1);
  expect(view.getByLabelText(/common\.quickAmountAccessibility:15/)).toBe(
    selected[0],
  );
});
