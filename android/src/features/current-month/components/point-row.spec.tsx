import { render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";

import { PointRow } from "./point-row";

jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ locale: "fr", t: (key: string) => key }),
}));
jest.mock("@/core/ui/haptics", () => ({ hapticSelection: jest.fn() }));

async function renderRow(isIncome?: boolean) {
  return render(
    <PaperProvider>
      <PointRow
        title="Remboursement"
        amount="42.00 CHF"
        isIncome={isIncome}
        isPointed={false}
        isSyncing={false}
        onToggle={jest.fn()}
        onOpen={jest.fn()}
      />
    </PaperProvider>,
  );
}

// The circle is the same for both natures: only the `+` tells a refund from the purchase.
it("keeps the + of an income", async () => {
  const view = await renderRow(true);

  expect(view.getByText("+42.00 CHF")).toBeTruthy();
});

it("leaves an outflow unsigned", async () => {
  const view = await renderRow();

  expect(view.getByText("42.00 CHF")).toBeTruthy();
  expect(view.queryByText("+42.00 CHF")).toBeNull();
});
