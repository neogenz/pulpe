import { fireEvent, render } from "@testing-library/react-native";
import type { ComponentProps } from "react";

import { NavigationBar } from "./navigation-bar";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const TABS = [
  ["home", "Accueil"],
  ["budgets", "Budgets"],
  ["goals", "Objectifs"],
  ["templates", "Modèles"],
] as const;

function barProps(): ComponentProps<typeof NavigationBar> {
  const routes = TABS.map(([name]) => ({ key: `${name}-key`, name }));
  const descriptors = Object.fromEntries(
    TABS.map(([name, title]) => [
      `${name}-key`,
      {
        options: { title, tabBarAccessibilityLabel: `Onglet ${title}` },
      },
    ]),
  );
  const navigation = {
    emit: jest.fn(() => ({ defaultPrevented: false })),
    navigate: jest.fn(),
  };
  return {
    state: { index: 0, routes },
    descriptors,
    navigation,
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  } as unknown as ComponentProps<typeof NavigationBar>;
}

// Paper keeps the bar at `pointerEvents="none"` until it has measured itself,
// which needs the layout event the test renderer never sends.
async function renderMeasured(props: ComponentProps<typeof NavigationBar>) {
  const view = await render(<NavigationBar {...props} />);
  await fireEvent(view.getByTestId("bottom-navigation-bar"), "layout", {
    nativeEvent: { layout: { width: 400, height: 80 } },
  });
  return view;
}

it("shows the four destinations by their catalog titles", async () => {
  const view = await renderMeasured(barProps());

  // Each label is painted twice, once per side of the active crossfade.
  for (const [, title] of TABS)
    expect(view.getAllByText(title).length).toBeGreaterThan(0);
  expect(view.getByLabelText("Onglet Accueil")).toBeTruthy();
});

it("navigates on press unless a listener prevented it", async () => {
  const props = barProps();
  const view = await renderMeasured(props);

  await fireEvent.press(view.getByTestId("tab-budgets"));

  expect(props.navigation.emit).toHaveBeenCalledWith({
    type: "tabPress",
    target: "budgets-key",
    canPreventDefault: true,
  });
  expect(props.navigation.navigate).toHaveBeenCalledWith("budgets", undefined);

  jest
    .mocked(props.navigation.emit)
    .mockReturnValueOnce({ defaultPrevented: true } as never);
  await fireEvent.press(view.getByTestId("tab-goals"));
  expect(props.navigation.navigate).toHaveBeenCalledTimes(1);
});
