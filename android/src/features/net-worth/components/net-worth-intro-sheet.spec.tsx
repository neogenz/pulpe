import { fireEvent, render } from "@testing-library/react-native";
import { ANALYTICS_EVENTS } from "pulpe-shared";
import type { ReactNode } from "react";

import { captureEvent } from "@/core/observability/analytics";

import { NetWorthIntroSheet } from "./net-worth-intro-sheet";

// The official mock pulls react-native-worklets' native module, which Jest 29
// cannot load. Reduce Motion is on: every amount shows its end value at once.
jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual("react-native");
  const passThrough = (value: unknown) => value;
  return {
    __esModule: true,
    default: { View },
    Easing: { out: passThrough, cubic: passThrough },
    useReducedMotion: () => true,
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (style: () => object) => style(),
    withDelay: (_delay: number, value: unknown) => value,
    withSequence: (...values: unknown[]) => values.at(-1),
    withSpring: passThrough,
    withTiming: passThrough,
  };
});
jest.mock("@/core/observability/analytics", () => ({
  captureEvent: jest.fn(),
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/core/ui/amount-visibility", () => ({
  areAmountsHidden: () => false,
}));
// The frame is FormModal's business; here it only has to show what it is given.
jest.mock("@/core/ui/sheet", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    FormModal: ({
      title,
      onDismiss,
      footer,
      children,
    }: {
      title: string;
      onDismiss: () => void;
      footer: ReactNode;
      children: ReactNode;
    }) => (
      <View>
        <Text>{title}</Text>
        <Pressable testID="close" onPress={onDismiss} />
        {children}
        {footer}
      </View>
    ),
  };
});

const capture = jest.mocked(captureEvent);
const endEvents = () =>
  capture.mock.calls.filter(
    ([event]) => event !== ANALYTICS_EVENTS.NET_WORTH_INTRO_VIEWED,
  );

async function open(isEmpty: boolean) {
  const onFinish = jest.fn();
  const view = await render(
    <NetWorthIntroSheet
      source="auto"
      isEmpty={isEmpty}
      currency="CHF"
      onFinish={onFinish}
    />,
  );
  return { view, onFinish };
}

beforeEach(() => capture.mockClear());

it("walks the three steps, the step's title in the header", async () => {
  const { view } = await open(false);
  expect(view.getByText("netWorth.intro.steps.overview.title")).toBeTruthy();
  expect(capture).toHaveBeenCalledWith(
    ANALYTICS_EVENTS.NET_WORTH_INTRO_VIEWED,
    {
      source: "auto",
    },
  );

  await fireEvent.press(view.getByTestId("net-worth-intro-primary"));
  expect(view.getByText("netWorth.intro.steps.netWorth.title")).toBeTruthy();
  expect(view.getByText("26’200 CHF")).toBeTruthy();

  await fireEvent.press(view.getByTestId("net-worth-intro-primary"));
  expect(view.getByText("netWorth.intro.steps.update.title")).toBeTruthy();
  expect(view.getByText("netWorth.intro.actions.done")).toBeTruthy();
});

it("offers to add a first account on an empty net worth, with one end event", async () => {
  const { view, onFinish } = await open(true);
  await fireEvent.press(view.getByTestId("net-worth-intro-primary"));
  await fireEvent.press(view.getByTestId("net-worth-intro-primary"));
  expect(view.getByText("netWorth.intro.actions.add")).toBeTruthy();

  await fireEvent.press(view.getByTestId("net-worth-intro-primary"));
  await fireEvent.press(view.getByTestId("close"));

  expect(onFinish).toHaveBeenCalledTimes(1);
  expect(onFinish).toHaveBeenCalledWith({ kind: "completed", action: "add" });
  expect(endEvents()).toEqual([
    [
      ANALYTICS_EVENTS.NET_WORTH_INTRO_COMPLETED,
      { source: "auto", action: "add_asset" },
    ],
  ]);
});

it("counts closing before the end as skipped at the current step", async () => {
  const { view, onFinish } = await open(false);
  await fireEvent.press(view.getByTestId("net-worth-intro-primary"));

  await fireEvent.press(view.getByTestId("close"));

  expect(onFinish).toHaveBeenCalledWith({ kind: "skipped", step: 1 });
  expect(endEvents()).toEqual([
    [ANALYTICS_EVENTS.NET_WORTH_INTRO_SKIPPED, { source: "auto", step: 1 }],
  ]);
});
