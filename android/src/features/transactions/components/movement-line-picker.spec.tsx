import type { BudgetLine, Transaction } from "pulpe-shared";
import { fireEvent, render } from "@testing-library/react-native";

import { lineSections } from "../movement-line-choices";
import { MovementLinePicker } from "./movement-line-picker";

jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ locale: "fr", t: (key: string) => key }),
}));
jest.mock("@/core/ui/amount-visibility", () => ({
  useAmountMasking: () => undefined,
  areAmountsHidden: () => false,
}));
jest.mock("@/core/ui/ripple", () => ({ useRipple: () => ({}) }));

function line(id: string, name: string, amount = 100): BudgetLine {
  return { id, name, amount, kind: "expense", checkedAt: null } as BudgetLine;
}

const lines = [
  line("food", "Épicerie"),
  line("rent", "Loyer", 50),
  line("phone", "Téléphone", 40),
];
const transactions = [
  { id: "t1", kind: "expense", amount: 80, budgetLineId: "rent" },
  { id: "t2", kind: "expense", amount: 40, budgetLineId: "phone" },
] as Transaction[];

async function renderPicker(
  onPick = jest.fn(),
  selectedLineId: string | null = null,
) {
  return render(
    <MovementLinePicker
      sections={lineSections(lines, transactions, "expense")}
      kind="expense"
      currency="CHF"
      selectedLineId={selectedLineId}
      onPick={onPick}
    />,
  );
}

describe("MovementLinePicker search", () => {
  it("narrows every section to the names that hold the query, accents and case aside", async () => {
    const onPick = jest.fn();
    const view = await renderPicker(onPick);
    expect(view.getByText("Loyer")).toBeTruthy();

    await fireEvent.changeText(
      view.getByTestId("movement-picker-search"),
      "epi",
    );

    expect(view.getByText("Épicerie")).toBeTruthy();
    expect(view.queryByText("Loyer")).toBeNull();
    expect(view.queryByText("Téléphone")).toBeNull();
    expect(
      view.queryByText("budgets.mutations.activity.picker.overSection"),
    ).toBeNull();
    await fireEvent.press(view.getByText("Épicerie"));
    expect(onPick).toHaveBeenCalledWith("food");
  });

  it("says nothing matches but still offers « imprévu »", async () => {
    const onPick = jest.fn();
    const view = await renderPicker(onPick);

    await fireEvent.changeText(
      view.getByTestId("movement-picker-search"),
      "zzz",
    );

    expect(
      view.getByText("budgets.mutations.activity.picker.noMatch"),
    ).toBeTruthy();
    await fireEvent.press(view.getByTestId("movement-picker-unplanned"));
    expect(onPick).toHaveBeenCalledWith(null);
  });

  it("shows no empty-result copy before the user types", async () => {
    const view = await renderPicker();

    expect(
      view.queryByText("budgets.mutations.activity.picker.noMatch"),
    ).toBeNull();
  });
});

describe("MovementLinePicker selection", () => {
  it("shows the check on the picked row only, not by colour alone", async () => {
    const view = await renderPicker(jest.fn(), "rent");
    // The icon is hidden from screen readers: the radio's checked state speaks.
    const checkOf = (id: string) =>
      view.queryByTestId(`movement-picker-check-${id}`, {
        includeHiddenElements: true,
      });

    expect(checkOf("rent")).not.toBeNull();
    for (const id of ["food", "phone", "unplanned"]) {
      expect(checkOf(id)).toBeNull();
    }
  });
});
