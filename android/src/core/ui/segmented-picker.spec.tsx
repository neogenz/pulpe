import { fireEvent, render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";

import { SegmentedPicker } from "./segmented-picker";
import {
  pulpeDarkTheme,
  pulpeLightTheme,
  SPACING,
  TOUCH_TARGET,
} from "./theme";

let mockFontScale = 1;
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ fontScale: mockFontScale }),
}));

it("extends each segment's touch area into the track padding", async () => {
  const onValueChange = jest.fn();
  const picker = (value: string) => (
    <SegmentedPicker
      value={value}
      onValueChange={onValueChange}
      buttons={[
        { value: "expense", label: "Dépense" },
        { value: "income", label: "Revenu" },
        { value: "saving", label: "Épargne", disabled: true },
      ]}
    />
  );
  const view = await render(picker("expense"));
  for (const segment of view.getAllByRole("radio")) {
    expect(segment).toHaveStyle({ minHeight: TOUCH_TARGET - SPACING.sm });
    expect(segment.props.hitSlop).toEqual({
      top: SPACING.xs,
      bottom: SPACING.xs,
    });
  }
  await fireEvent.press(
    view.getByRole("radio", { name: "Dépense", checked: true }),
  );
  await fireEvent.press(
    view.getByRole("radio", { name: "Épargne", disabled: true }),
  );
  expect(onValueChange).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole("radio", { name: "Revenu" }));
  expect(onValueChange).toHaveBeenCalledWith("income");
  await view.rerender(picker("income"));
  expect(
    view.getByRole("radio", { name: "Revenu", checked: true }),
  ).toBeOnTheScreen();
});

it.each(
  [pulpeLightTheme, pulpeDarkTheme].flatMap((theme) =>
    [1, 2].map((fontScale) => ({ theme, fontScale, dark: theme.dark })),
  ),
)(
  "allows long labels to wrap at large sizes (dark: $dark, scale: $fontScale)",
  async ({ theme, fontScale }) => {
    mockFontScale = fontScale;
    const view = await render(
      <PaperProvider theme={theme}>
        <SegmentedPicker
          value="monthly"
          onValueChange={jest.fn()}
          buttons={[
            { value: "monthly", label: "Monatlich" },
            { value: "once", label: "Einmalig" },
          ]}
        />
      </PaperProvider>,
    );
    expect(view.getByText("Monatlich").props.numberOfLines).toBe(
      fontScale === 1 ? 1 : undefined,
    );
    expect(
      view.getByRole("radio", { name: "Monatlich", checked: true }),
    ).toHaveStyle({
      borderColor: theme.colors.outline,
    });
  },
);
