import { fireEvent, render } from "@testing-library/react-native";
import { IconButton } from "react-native-paper";

import { TabHeader } from "./tab-header";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

it("shows the title and the trailing action", async () => {
  const onPress = jest.fn();
  const view = await render(
    <TabHeader
      title="Budgets"
      trailing={
        <IconButton
          icon="account-circle-outline"
          accessibilityLabel="Compte"
          onPress={onPress}
        />
      }
    />,
  );

  expect(view.getByText("Budgets")).toBeTruthy();
  await fireEvent.press(view.getByLabelText("Compte"));
  expect(onPress).toHaveBeenCalledTimes(1);
});
