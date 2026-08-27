import { fireEvent, render } from "@testing-library/react-native";

import type { CheckableItem } from "../current-month-view-model";
import { UncheckedOperationsCard } from "./unchecked-operations-card";

const { readFileSync } = jest.requireActual<{
  readFileSync(path: string, encoding: "utf8"): string;
}>("node:fs");

jest.mock("@/core/ui/haptics", () => ({
  hapticCommit: jest.fn(),
  hapticSelection: jest.fn(),
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({
    locale: "fr",
    t: (key: string, params?: Record<string, unknown>) =>
      params === undefined ? key : `${key}:${JSON.stringify(params)}`,
  }),
}));

function item(id: string, name: string): CheckableItem {
  return {
    id,
    name,
    source: "budgetLine",
    sourceId: id,
    kind: "expense",
    amount: 1450,
    consumption: null,
    subtitle: { kind: "recurrence", value: "fixed" },
  };
}

const items = [item("rent", "Loyer"), item("phone", "Téléphone")];

it("asks about the first operation and points it on confirm", async () => {
  const onToggle = jest.fn();
  const view = await render(
    <UncheckedOperationsCard
      items={items}
      currency="CHF"
      isSyncing={false}
      onToggle={onToggle}
    />,
  );

  expect(view.getByText("home.checking.title · 2")).toBeTruthy();
  expect(view.getByText("Loyer")).toBeTruthy();
  expect(view.getByText(/1.?450/)).toBeTruthy();

  await fireEvent.press(view.getByText("home.checking.confirm"));

  expect(onToggle).toHaveBeenCalledWith(items[0]);
});

it("rotates to the next operation on later and wraps at the end", async () => {
  const view = await render(
    <UncheckedOperationsCard
      items={items}
      currency="CHF"
      isSyncing={false}
      onToggle={jest.fn()}
    />,
  );

  await fireEvent.press(view.getByText("home.checking.later"));
  expect(view.getByText("Téléphone")).toBeTruthy();
  expect(view.queryByText("Loyer")).toBeNull();

  await fireEvent.press(view.getByText("home.checking.later"));
  expect(view.getByText("Loyer")).toBeTruthy();
});

it("renders nothing with nothing to point", async () => {
  const view = await render(
    <UncheckedOperationsCard
      items={[]}
      currency="CHF"
      isSyncing={false}
      onToggle={jest.fn()}
    />,
  );

  expect(view.toJSON()).toBeNull();
});

it("is the only tinted container under the hero", () => {
  const sources = [
    "unchecked-operations-card",
    "drift-card",
    "activity-card",
    "savings-done-card",
  ].map((name) =>
    readFileSync(`src/features/current-month/components/${name}.tsx`, "utf8"),
  );

  expect(sources[0]).toContain("theme.colors.secondaryContainer");
  expect(sources.join("\n")).not.toContain("surfaceVariant }");
});
