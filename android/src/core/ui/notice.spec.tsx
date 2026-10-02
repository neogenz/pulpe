import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from "react-native-paper";

import { Notice } from "./notice";
import { FAB_CLEARANCE } from "./theme";

function wrapperOf(view: Awaited<ReturnType<typeof render>>) {
  // The Snackbar's own node is the surface; its parent is the wrapper Paper
  // positions with `wrapperStyle`.
  return view.getByTestId("notice").parent!;
}

it("shows the message and hands the action to its handler", async () => {
  const onPress = jest.fn();
  const view = await render(
    <PaperProvider theme={MD3LightTheme}>
      <Notice
        visible
        onDismiss={jest.fn()}
        action={{ label: "Annuler", onPress }}
        testID="notice"
      >
        Prévision ajoutée
      </Notice>
    </PaperProvider>,
  );

  expect(view.getByText("Prévision ajoutée")).toBeTruthy();
  await fireEvent.press(view.getByText("Annuler"));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it("clears the FAB when asked and sits on the edge otherwise", async () => {
  const cleared = await render(
    <PaperProvider theme={MD3LightTheme}>
      <Notice visible onDismiss={jest.fn()} clearsFab testID="notice">
        Prévision ajoutée
      </Notice>
    </PaperProvider>,
  );
  const flush = await render(
    <PaperProvider theme={MD3LightTheme}>
      <Notice visible onDismiss={jest.fn()} testID="notice">
        Prévision ajoutée
      </Notice>
    </PaperProvider>,
  );

  expect(StyleSheet.flatten(wrapperOf(cleared).props.style).bottom).toBe(
    FAB_CLEARANCE,
  );
  expect(StyleSheet.flatten(wrapperOf(flush).props.style).bottom).toBe(0);
});

it("keeps the inversion in light and drops it in dark", async () => {
  const light = await render(
    <PaperProvider theme={MD3LightTheme}>
      <Notice visible onDismiss={jest.fn()} testID="notice">
        Prévision ajoutée
      </Notice>
    </PaperProvider>,
  );
  const dark = await render(
    <PaperProvider theme={MD3DarkTheme}>
      <Notice visible onDismiss={jest.fn()} testID="notice">
        Prévision ajoutée
      </Notice>
    </PaperProvider>,
  );

  expect(
    StyleSheet.flatten(light.getByTestId("notice").props.style).backgroundColor,
  ).toBe(MD3LightTheme.colors.inverseSurface);
  expect(
    StyleSheet.flatten(dark.getByTestId("notice").props.style).backgroundColor,
  ).toBe(MD3DarkTheme.colors.elevation.level3);
});
