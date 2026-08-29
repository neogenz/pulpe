import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { MD3LightTheme } from "react-native-paper";

import { StatusBadge } from "./status-badge";
import { RADIUS } from "./theme";

it("names the state on a primary capsule that hugs its word", async () => {
  const view = await render(<StatusBadge>Mois actuel</StatusBadge>);

  expect(
    StyleSheet.flatten(view.getByText("Mois actuel").props.style).color,
  ).toBe(MD3LightTheme.colors.onPrimary);

  const badge = view.toJSON() as unknown as { props: { style: unknown } };
  expect(StyleSheet.flatten(badge.props.style)).toEqual(
    expect.objectContaining({
      backgroundColor: MD3LightTheme.colors.primary,
      borderRadius: RADIUS.full,
      alignSelf: "flex-start",
    }),
  );
});
