import { fireEvent, render } from "@testing-library/react-native";

import { SectionHeader } from "./section-header";
import { TOUCH_TARGET } from "./theme";

it("gives the section link a 48dp target", async () => {
  const onPress = jest.fn();
  const view = await render(
    <SectionHeader title="Mouvements" link={{ label: "Tout voir", onPress }} />,
  );
  expect(view.getByRole("header", { name: "Mouvements" })).toBeOnTheScreen();
  const link = view.getByRole("button", { name: "Tout voir" });
  expect(view.getByTestId("button-container")).toHaveStyle({
    minWidth: TOUCH_TARGET,
  });
  expect(view.getByText("Tout voir").parent).toHaveStyle({
    minHeight: TOUCH_TARGET,
  });
  await fireEvent.press(link);
  expect(onPress).toHaveBeenCalledTimes(1);
});
