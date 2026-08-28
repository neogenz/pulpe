import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { MD3LightTheme } from "react-native-paper";

import { Eyebrow } from "./eyebrow";
import { UPPERCASE_TRACKING } from "./theme";

it("keeps the sentence and sets the capitals with their tracking in style", async () => {
  const view = await render(<Eyebrow>Zone de danger</Eyebrow>);
  const eyebrow = view.getByText("Zone de danger");

  expect(StyleSheet.flatten(eyebrow.props.style)).toEqual(
    expect.objectContaining({
      textTransform: "uppercase",
      letterSpacing: UPPERCASE_TRACKING,
      color: MD3LightTheme.colors.onSurfaceVariant,
    }),
  );
});
