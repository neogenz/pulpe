import { act, fireEvent, render } from "@testing-library/react-native";
import { useState } from "react";
import { BackHandler, Pressable, Text, View } from "react-native";

import { Menu } from "./menu";

// Paper's Menu animates and measures through portals; what matters here is
// whether its entries are on screen.
jest.mock("react-native-paper", () => ({
  Menu: Object.assign(
    ({
      visible,
      anchor,
      children,
    }: {
      visible: boolean;
      anchor: React.ReactNode;
      children: React.ReactNode;
    }) => (
      <>
        {anchor}
        {visible ? children : null}
      </>
    ),
    { Item: () => null },
  ),
}));

type BackListener = Parameters<typeof BackHandler.addEventListener>[1];

// Android's Back, as React Native dispatches it: the latest listener first,
// down the stack until one of them returns true.
let listeners: BackListener[] = [];
async function pressBack() {
  await act(() => {
    [...listeners]
      .reverse()
      .some((listener) =>
        listener({ type: "hardwareBackPress", timeStamp: 0 }),
      );
  });
}

beforeEach(() => {
  listeners = [];
  jest
    .spyOn(BackHandler, "addEventListener")
    .mockImplementation((_event, listener) => {
      listeners.push(listener);
      return {
        remove: () => {
          listeners = listeners.filter((other) => other !== listener);
        },
      };
    });
});

afterEach(() => jest.restoreAllMocks());

function Screen() {
  const [isOpen, setOpen] = useState(false);
  return (
    <View>
      <Text>Courses</Text>
      <Menu
        visible={isOpen}
        onDismiss={() => setOpen(false)}
        anchor={
          <Pressable accessibilityRole="button" onPress={() => setOpen(true)}>
            <Text>Options</Text>
          </Pressable>
        }
      >
        <Text>Supprimer</Text>
      </Menu>
    </View>
  );
}

describe("Menu", () => {
  it("closes on Back and keeps the screen it was opened from", async () => {
    // The router listens first, for as long as the screen is shown.
    const leaveScreen = jest.fn(() => true);
    BackHandler.addEventListener("hardwareBackPress", leaveScreen);
    const view = await render(<Screen />);

    await fireEvent.press(view.getByText("Options"));
    expect(view.getByText("Supprimer")).toBeTruthy();

    await pressBack();

    expect(view.queryByText("Supprimer")).toBeNull();
    expect(view.getByText("Courses")).toBeTruthy();
    expect(leaveScreen).not.toHaveBeenCalled();

    await pressBack();

    expect(leaveScreen).toHaveBeenCalledTimes(1);
  });

  it("closes with the latest onDismiss after the screen re-renders", async () => {
    const dismissed = jest.fn();
    function RefreshingScreen() {
      const [isOpen, setOpen] = useState(false);
      const [refreshCount, setRefreshCount] = useState(0);
      return (
        <View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setRefreshCount((count) => count + 1)}
          >
            <Text>Rafraîchir</Text>
          </Pressable>
          <Menu
            visible={isOpen}
            onDismiss={() => {
              dismissed(refreshCount);
              setOpen(false);
            }}
            anchor={
              <Pressable
                accessibilityRole="button"
                onPress={() => setOpen(true)}
              >
                <Text>Options</Text>
              </Pressable>
            }
          >
            <Text>Supprimer</Text>
          </Menu>
        </View>
      );
    }
    const view = await render(<RefreshingScreen />);

    await fireEvent.press(view.getByText("Options"));
    await fireEvent.press(view.getByText("Rafraîchir"));
    await pressBack();

    expect(view.queryByText("Supprimer")).toBeNull();
    expect(dismissed).toHaveBeenCalledTimes(1);
    expect(dismissed).toHaveBeenCalledWith(1);
    // One Back listener for the whole time the menu stayed open.
    expect(BackHandler.addEventListener).toHaveBeenCalledTimes(1);
  });
});
