import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { PaperProvider } from "react-native-paper";

import { TransactionDialog } from "./transaction-dialog";

let mockKeyboardHeight = 0;

jest.mock("@/core/ui/keyboard-inset", () => ({
  useKeyboardHeight: () => mockKeyboardHeight,
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ locale: "fr", t: (key: string) => key }),
}));
jest.mock("@/core/ui/amount-field", () => ({ AmountField: () => null }));
// Mints ids through the native crypto binding, which no test can load.
jest.mock("../onboarding-transaction", () => ({
  createCustomTransaction: jest.fn(),
}));

type Element = ReturnType<Awaited<ReturnType<typeof render>>["getByText"]>;

/** The vertical shift applied to the closest transformed element up the tree. */
function liftAround(element: Element): number | undefined {
  let node: Element | null = element;
  while (node !== null) {
    const { transform } = StyleSheet.flatten(node.props.style) ?? {};
    if (Array.isArray(transform)) {
      const shift = transform.find(
        (entry): entry is { translateY: number } => "translateY" in entry,
      );
      if (shift !== undefined) return shift.translateY;
    }
    node = node.parent;
  }
  return undefined;
}

function dialog() {
  return (
    <PaperProvider>
      <TransactionDialog
        kind="expense"
        currency="CHF"
        editing={null}
        onDismiss={jest.fn()}
        onSubmit={jest.fn()}
      />
    </PaperProvider>
  );
}

/**
 * Paper's Dialog has no keyboard handling, and the edge-to-edge window keeps
 * its full height under the IME: the "Ajouter" action sat under the keys.
 */
it("rises by half the keyboard so it centres in the room left above it", async () => {
  const view = await render(dialog());
  expect(liftAround(view.getByText("onboarding.transaction.add"))).toBeCloseTo(
    0,
  );

  mockKeyboardHeight = 300;
  await view.rerender(dialog());

  expect(liftAround(view.getByText("onboarding.transaction.add"))).toBe(-150);
});
