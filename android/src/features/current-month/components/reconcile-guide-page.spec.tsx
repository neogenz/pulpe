import { fireEvent, render, within } from "@testing-library/react-native";
import { ANALYTICS_EVENTS, type SupportedCurrency } from "pulpe-shared";
import { View } from "react-native";

import { captureEvent } from "@/core/observability/analytics";

import type { GuideSource } from "../reconcile-guide";
import { useReconcileGuidePage } from "./reconcile-guide-page";

// The official mock pulls react-native-worklets' native module, which Jest 29
// cannot load. Reduce Motion is on: every scene shows its end state at once.
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
let mockAmountsHidden = false;
jest.mock("@/core/ui/amount-visibility", () => ({
  areAmountsHidden: () => mockAmountsHidden,
}));

let mockWindowHeight = 844;
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({
    width: 390,
    height: mockWindowHeight,
    scale: 1,
    fontScale: 1,
  }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockMarkSeen = jest.fn();
jest.mock("../reconcile-guide-gate", () => ({
  markReconcileGuideSeen: () => mockMarkSeen(),
}));

const capture = jest.mocked(captureEvent);
const endEvents = () =>
  capture.mock.calls.filter(
    ([event]) => event !== ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_GUIDE_VIEWED,
  );

async function open(
  source: GuideSource = "auto",
  currency: SupportedCurrency = "CHF",
) {
  const onFinish = jest.fn();
  function Harness() {
    const guide = useReconcileGuidePage({ source, currency, onFinish });
    return (
      <View>
        {guide?.body}
        {guide?.footer}
        {guide?.skipAction}
      </View>
    );
  }
  return { view: await render(<Harness />), onFinish };
}

beforeEach(() => {
  capture.mockClear();
  mockMarkSeen.mockClear();
  mockAmountsHidden = false;
  mockWindowHeight = 844;
});

it("walks the three scenes, title and sentence each, the drawing hidden from TalkBack", async () => {
  const { view } = await open();
  expect(capture).toHaveBeenCalledWith(
    ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_GUIDE_VIEWED,
    { source: "auto" },
  );
  for (const scene of ["compare", "type", "check"]) {
    expect(
      view.getByText(`home.reconcile.guide.scenes.${scene}.title`),
    ).toBeTruthy();
    expect(
      view.getByText(`home.reconcile.guide.scenes.${scene}.body`),
    ).toBeTruthy();
    expect(view.queryByTestId("reconcile-guide-scene")).toBeNull();
    expect(
      view.getByTestId("reconcile-guide-scene", {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    if (scene !== "check") {
      await fireEvent.press(view.getByTestId("reconcile-guide-primary"));
    }
  }
  expect(view.getByText("home.reconcile.guide.start")).toBeTruthy();
  // Reduce Motion: Pulpe's figure is already 890.00 at first render.
  const row = view.getByTestId("reconcile-guide-pulpe-row", {
    includeHiddenElements: true,
  });
  expect(
    within(row).getByText("890.00", { includeHiddenElements: true }),
  ).toBeTruthy();
  expect(
    view.queryByText("950.00", { includeHiddenElements: true }),
  ).toBeNull();
});

it("ends once as completed on « Comparer maintenant »", async () => {
  const { view, onFinish } = await open();
  for (let press = 0; press < 3; press += 1) {
    await fireEvent.press(view.getByTestId("reconcile-guide-primary"));
  }
  await fireEvent.press(view.getByTestId("reconcile-guide-primary"));

  expect(onFinish).toHaveBeenCalledTimes(1);
  expect(onFinish).toHaveBeenCalledWith("completed");
  expect(endEvents()).toEqual([
    [
      ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_GUIDE_COMPLETED,
      { source: "auto" },
    ],
  ]);
});

it("ends once as skipped, with the source it was opened from", async () => {
  const { view, onFinish } = await open("help");
  await fireEvent.press(view.getByTestId("reconcile-guide-skip"));
  await fireEvent.press(view.getByTestId("reconcile-guide-skip"));

  expect(onFinish).toHaveBeenCalledTimes(1);
  expect(onFinish).toHaveBeenCalledWith("skipped");
  expect(endEvents()).toEqual([
    [ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_GUIDE_SKIPPED, { source: "help" }],
  ]);
});

it("leaves the sample figures readable when amounts are hidden", async () => {
  mockAmountsHidden = true;
  const { view } = await open();
  expect(
    view.getByText("home.reconcile.guide.scenes.compare.title"),
  ).toBeTruthy();
  expect(
    view.getByText("890.00", { includeHiddenElements: true }),
  ).toBeTruthy();
  expect(view.queryByText("•••", { includeHiddenElements: true })).toBeNull();
});

it("shows the sample figures with the budget currency's separators, amounts hidden or not", async () => {
  mockAmountsHidden = true;
  const eur = await open("auto", "EUR");
  expect(
    eur.view.getByText("890,00", { includeHiddenElements: true }),
  ).toBeTruthy();
  expect(
    eur.view.queryByText("•••", { includeHiddenElements: true }),
  ).toBeNull();
});

it("counts a guide unmounted with no exit as skipped once, and remembers it", async () => {
  const { view, onFinish } = await open("auto");

  await view.unmount();

  expect(endEvents()).toEqual([
    [ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_GUIDE_SKIPPED, { source: "auto" }],
  ]);
  expect(mockMarkSeen).toHaveBeenCalledTimes(1);
  expect(onFinish).not.toHaveBeenCalled();
});

it("does not count a second end when a finished guide unmounts", async () => {
  const { view } = await open("help");
  await fireEvent.press(view.getByTestId("reconcile-guide-skip"));

  await view.unmount();

  expect(endEvents()).toHaveLength(1);
  expect(mockMarkSeen).not.toHaveBeenCalled();
});

it.each([
  [844, 288],
  [600, 232],
])("sizes the scene for a %i dp window to %i dp", async (height, expected) => {
  mockWindowHeight = height;
  const { view } = await open();
  expect(
    view.getByTestId("reconcile-guide-scene", { includeHiddenElements: true }),
  ).toHaveStyle({ minHeight: expected });
});
