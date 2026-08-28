import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { MD3LightTheme } from "react-native-paper";

import { FieldError } from "./field-error";

it("announces itself: an error line in the error colour on a polite live region", async () => {
  const view = await render(<FieldError visible>Montant requis</FieldError>);
  const line = view.getByText("Montant requis");

  expect(line.props.accessibilityLiveRegion).toBe("polite");
  expect(StyleSheet.flatten(line.props.style).color).toBe(
    MD3LightTheme.colors.error,
  );
});
