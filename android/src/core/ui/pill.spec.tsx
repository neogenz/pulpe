import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { Pill } from "./pill";
import { RADIUS, TINT_ALPHA } from "./theme";

it("shows the figure and its label on a capsule tinted from one accent", async () => {
  const view = await render(
    <Pill icon="arrow-up" amount="+ 340" label="épargné" tint="#1DB98A" />,
  );

  expect(view.getByText("+ 340")).toBeTruthy();
  expect(view.getByText("épargné")).toBeTruthy();
  expect(StyleSheet.flatten(view.getByText("+ 340").props.style).color).toBe(
    "#1DB98A",
  );

  const capsule = view.toJSON() as unknown as { props: { style: unknown } };
  expect(StyleSheet.flatten(capsule.props.style)).toEqual(
    expect.objectContaining({
      backgroundColor: `#1DB98A${TINT_ALPHA.surface}`,
      borderRadius: RADIUS.full,
    }),
  );
});
