import { act, fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { PaperProvider } from "react-native-paper";

import { SwipeToPoint } from "./swipe-to-point";

const mockClose = jest.fn();
const mockRowPress = jest.fn();
const mockSwipeable: { props: Record<string, unknown> | null } = {
  props: null,
};

jest.mock("react-native-gesture-handler/ReanimatedSwipeable", () => {
  const { forwardRef, useImperativeHandle } = jest.requireActual("react");
  const Swipeable = forwardRef(
    (props: Record<string, unknown>, ref: unknown) => {
      mockSwipeable.props = props;
      useImperativeHandle(ref, () => ({ close: mockClose }));
      return props.children;
    },
  );
  return { __esModule: true, default: Swipeable };
});
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ locale: "fr", t: (key: string) => key }),
}));
jest.mock("@/core/ui/haptics", () => ({ hapticCommit: jest.fn() }));

async function renderRow(
  overrides: Partial<Parameters<typeof SwipeToPoint>[0]> = {},
) {
  const onPoint = jest.fn();
  const view = await render(
    <PaperProvider>
      <SwipeToPoint
        isChecked={false}
        tint="#B35800"
        isEnabled
        onPoint={onPoint}
        {...overrides}
      >
        {(guard) => <Text onPress={guard(mockRowPress)}>Loyer</Text>}
      </SwipeToPoint>
    </PaperProvider>,
  );
  return { onPoint, view };
}

beforeEach(() => jest.clearAllMocks());

it("points the row once dragged far enough, then springs it home", async () => {
  const { onPoint, view } = await renderRow();

  expect(view.getByText("Loyer")).toBeTruthy();
  (mockSwipeable.props?.onSwipeableOpen as () => void)();

  expect(onPoint).toHaveBeenCalledTimes(1);
  expect(mockClose).toHaveBeenCalledTimes(1);
});

it("only answers a drag to the right, and only past its threshold", async () => {
  await renderRow();

  expect(mockSwipeable.props?.renderRightActions).toBeUndefined();
  expect(mockSwipeable.props?.leftThreshold).toBeGreaterThan(0);
  expect(mockSwipeable.props?.overshootLeft).toBe(false);
});

it("names what letting go will do: point, or take the pointing back", async () => {
  await renderRow();
  const point = await render(
    <PaperProvider>
      {(mockSwipeable.props?.renderLeftActions as () => React.ReactNode)()}
    </PaperProvider>,
  );
  expect(
    point.getByText("budgets.detail.swipe.point", {
      includeHiddenElements: true,
    }),
  ).toBeTruthy();

  await renderRow({ isChecked: true });
  const unpoint = await render(
    <PaperProvider>
      {(mockSwipeable.props?.renderLeftActions as () => React.ReactNode)()}
    </PaperProvider>,
  );
  expect(
    unpoint.getByText("budgets.detail.swipe.unpoint", {
      includeHiddenElements: true,
    }),
  ).toBeTruthy();
});

it("holds still on a row that cannot be pointed here", async () => {
  await renderRow({ isEnabled: false });

  expect(mockSwipeable.props?.enabled).toBe(false);
});

/**
 * Lifting the finger at the end of a drag reaches the row as a tap too — on
 * the web build it opened the line the user had just pointed.
 */
it("keeps the row's own tap silent from the start of a drag until it is home", async () => {
  const { view } = await renderRow();
  const props = () => mockSwipeable.props as Record<string, () => void>;

  await act(() => props().onSwipeableOpenStartDrag());
  await fireEvent.press(view.getByText("Loyer"));
  expect(mockRowPress).not.toHaveBeenCalled();

  await act(() => props().onSwipeableClose());
  await fireEvent.press(view.getByText("Loyer"));
  expect(mockRowPress).toHaveBeenCalledTimes(1);
});
