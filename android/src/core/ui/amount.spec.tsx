import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { MD3LightTheme } from "react-native-paper";

import { Amount } from "./amount";
import { TABULAR_DIGITS } from "./theme";

it("sets tabular figures on every voice", async () => {
  const view = await render(<Amount size="row">1’240.50</Amount>);

  expect(StyleSheet.flatten(view.getByText("1’240.50").props.style)).toEqual(
    expect.objectContaining({
      ...TABULAR_DIGITS,
      color: MD3LightTheme.colors.onSurface,
    }),
  );
});

it("keeps a hero on one line that shrinks instead of wrapping", async () => {
  const view = await render(<Amount size="hero">1’240’000.00</Amount>);
  const hero = view.getByText("1’240’000.00");

  expect(hero.props.numberOfLines).toBe(1);
  expect(hero.props.adjustsFontSizeToFit).toBe(true);
  expect(hero.props.minimumFontScale).toBe(0.6);
});

it("lets a row wrap as told and colours a tone from the financial palette", async () => {
  const view = await render(
    <Amount size="row" tone="expense" numberOfLines={2}>
      -40.00
    </Amount>,
  );
  const amount = view.getByText("-40.00");

  expect(amount.props.numberOfLines).toBe(2);
  expect(amount.props.adjustsFontSizeToFit).toBeFalsy();
  expect(StyleSheet.flatten(amount.props.style).color).not.toBe(
    MD3LightTheme.colors.onSurface,
  );
});
