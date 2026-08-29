import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { FilterChip } from "./filter-chip";

function fill(view: Awaited<ReturnType<typeof render>>) {
  return StyleSheet.flatten(view.getByTestId("chip-container").props.style)
    .backgroundColor;
}

it("carries the selection in its fill and its accessibility state", async () => {
  const selected = await render(<FilterChip selected>Mars</FilterChip>);
  const idle = await render(<FilterChip selected={false}>Avril</FilterChip>);

  expect(selected.getByRole("button").props.accessibilityState).toEqual(
    expect.objectContaining({ selected: true }),
  );
  expect(idle.getByRole("button").props.accessibilityState).toEqual(
    expect.objectContaining({ selected: false }),
  );
  expect(fill(selected)).not.toBe(fill(idle));
  expect(selected.queryByTestId("chip-selected-icon")).toBeNull();
});

it("answers a press", async () => {
  const onPress = jest.fn();
  const view = await render(
    <FilterChip selected={false} onPress={onPress}>
      Avril
    </FilterChip>,
  );

  await fireEvent.press(view.getByText("Avril"));

  expect(onPress).toHaveBeenCalledTimes(1);
});
