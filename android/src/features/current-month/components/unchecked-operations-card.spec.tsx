import { fireEvent, render } from "@testing-library/react-native";
import { FlatList } from "react-native";

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

const notPending = () => false;

/** The pager lays its pages out once its frame has a width. */
async function layOut(view: Awaited<ReturnType<typeof render>>) {
  await fireEvent(view.getByTestId("unchecked-pager-frame"), "layout", {
    nativeEvent: { layout: { width: 360, height: 160, x: 0, y: 0 } },
  });
}

it("asks about each operation on its own page and points the one confirmed", async () => {
  const onToggle = jest.fn();
  const view = await render(
    <UncheckedOperationsCard
      items={items}
      totalCount={9}
      currency="CHF"
      isPending={notPending}
      onToggle={onToggle}
    />,
  );
  // Before its frame is measured, the first page stands alone.
  expect(view.getByText("1 / 2")).toBeTruthy();
  expect(view.queryByText("2 / 2")).toBeNull();
  await layOut(view);

  // The header counts every operation left, not just the queue it shows.
  expect(
    view.getByText("home.checking.title\u00A0\u00A0·\u00A09"),
  ).toBeTruthy();
  expect(view.getByText("Loyer")).toBeTruthy();
  expect(view.getByText("1 / 2")).toBeTruthy();
  expect(view.getByText("2 / 2")).toBeTruthy();

  await fireEvent.press(
    view.getByLabelText(
      'home.checking.confirmAccessibility:{"name":"Téléphone"}',
    ),
  );

  expect(onToggle).toHaveBeenCalledWith(items[1]);
});

it("slides to the next page on later, and back to the first from the last", async () => {
  const view = await render(
    <UncheckedOperationsCard
      items={items}
      totalCount={items.length}
      currency="CHF"
      isPending={notPending}
      onToggle={jest.fn()}
    />,
  );
  await layOut(view);
  // The test renderer has no native scroll view to move; the pager's own
  // method is what "Plus tard" is expected to drive.
  const scrollToOffset = jest
    .spyOn(FlatList.prototype, "scrollToOffset")
    .mockImplementation(() => undefined);

  await fireEvent.press(
    view.getByLabelText('home.checking.laterAccessibility:{"name":"Loyer"}'),
  );
  await fireEvent.press(
    view.getByLabelText(
      'home.checking.laterAccessibility:{"name":"Téléphone"}',
    ),
  );

  const offsets = scrollToOffset.mock.calls.map(([call]) => call.offset);
  // One page and the gap after it.
  expect(offsets[0]).toBe(360 + 8);
  expect(offsets[1]).toBe(0);
  scrollToOffset.mockRestore();
});

it("holds only the operation in flight, not the whole queue", async () => {
  const view = await render(
    <UncheckedOperationsCard
      items={items}
      totalCount={items.length}
      currency="CHF"
      isPending={(item) => item.id === "rent"}
      onToggle={jest.fn()}
    />,
  );
  await layOut(view);

  const confirmFor = (name: string) =>
    view.getByLabelText(
      `home.checking.confirmAccessibility:${JSON.stringify({ name })}`,
    );
  expect(confirmFor("Loyer")).toBeDisabled();
  expect(confirmFor("Téléphone")).not.toBeDisabled();
});

it("offers no later when there is only one operation left", async () => {
  const view = await render(
    <UncheckedOperationsCard
      items={[items[0]!]}
      totalCount={1}
      currency="CHF"
      isPending={notPending}
      onToggle={jest.fn()}
    />,
  );

  expect(view.queryByText("home.checking.later")).toBeNull();
  expect(view.getByText("1 / 1")).toBeTruthy();
});

it("renders nothing with nothing to point", async () => {
  const view = await render(
    <UncheckedOperationsCard
      items={[]}
      totalCount={0}
      currency="CHF"
      isPending={notPending}
      onToggle={jest.fn()}
    />,
  );

  expect(view.toJSON()).toBeNull();
});

it("carries the question on the same paper as every other section", () => {
  const sources = [
    "unchecked-operations-card",
    "drift-card",
    "activity-card",
    "savings-done-card",
  ].map((name) =>
    readFileSync(`src/features/current-month/components/${name}.tsx`, "utf8"),
  );

  expect(sources[0]).toContain("theme.colors.surface }");
  expect(sources.join("\n")).not.toContain("secondaryContainer");
});
