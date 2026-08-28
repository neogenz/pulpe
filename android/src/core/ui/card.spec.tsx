import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { Text } from "react-native-paper";

import { Card } from "./card";
import { RADIUS } from "./theme";

it("draws every card at the app radius, not Paper's 3 × roundness", async () => {
  const view = await render(
    <Card>
      <Card.Content>
        <Text>Loyer</Text>
      </Card.Content>
    </Card>,
  );

  expect(view.getByText("Loyer")).toBeTruthy();
  expect(
    StyleSheet.flatten(view.getByTestId("card-container").props.style)
      .borderRadius,
  ).toBe(RADIUS.card);
});

it("keeps the radius under a layout style", async () => {
  const view = await render(
    <Card style={{ marginTop: 8 }}>
      <Card.Content>
        <Text>Loyer</Text>
      </Card.Content>
    </Card>,
  );

  expect(
    StyleSheet.flatten(view.getByTestId("card-container").props.style),
  ).toEqual(
    expect.objectContaining({ borderRadius: RADIUS.card, marginTop: 8 }),
  );
});
