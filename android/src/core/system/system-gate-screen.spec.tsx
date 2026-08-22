import { fireEvent, render } from "@testing-library/react-native";
import { Linking } from "react-native";

import { SystemGateScreen } from "./system-gate-screen";
import { checkSystemGate } from "./system-store";

const mockReducedMotion = { value: false };
const mockSystem = {
  gate: "ok",
  storeUrl: null as string | null,
  isChecking: false,
};

jest.mock("./system-store", () => ({
  checkSystemGate: jest.fn(),
  useSystemStore: (selector: (state: typeof mockSystem) => unknown) =>
    selector(mockSystem),
}));
jest.mock("react-native-reanimated", () => ({
  useReducedMotion: () => mockReducedMotion.value,
}));
jest.mock("lottie-react-native", () => {
  const { View } = jest.requireActual("react-native");
  return function LottieMock({
    autoPlay,
    loop,
  }: {
    autoPlay: boolean;
    loop: boolean;
  }) {
    return (
      <View testID="maintenance-animation" autoPlay={autoPlay} loop={loop} />
    );
  };
});
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockedCheckSystemGate = jest.mocked(checkSystemGate);

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockSystem, { gate: "ok", storeUrl: null, isChecking: false });
  mockReducedMotion.value = false;
});

it("keeps maintenance blocking and respects reduced motion", async () => {
  Object.assign(mockSystem, { gate: "maintenance" });
  mockReducedMotion.value = true;
  const view = await render(<SystemGateScreen />);

  expect(view.getByText("system.gate.maintenance.title")).toBeTruthy();
  expect(view.getByTestId("maintenance-animation").props.autoPlay).toBe(false);
  await fireEvent.press(view.getByText("common.retry"));
  expect(mockedCheckSystemGate).toHaveBeenCalledTimes(1);
});

it("opens the store for a forced update", async () => {
  jest.spyOn(Linking, "openURL").mockResolvedValueOnce(true);
  Object.assign(mockSystem, {
    gate: "forceUpdate",
    storeUrl: "https://store.test/pulpe",
  });
  const view = await render(<SystemGateScreen />);

  await fireEvent.press(view.getByText("system.gate.forceUpdate.action"));

  expect(Linking.openURL).toHaveBeenCalledWith("https://store.test/pulpe");
  expect(mockedCheckSystemGate).not.toHaveBeenCalled();
});

it("rechecks a forced update that has no store URL", async () => {
  Object.assign(mockSystem, { gate: "forceUpdate" });
  const view = await render(<SystemGateScreen />);

  await fireEvent.press(view.getByText("common.retry"));

  expect(mockedCheckSystemGate).toHaveBeenCalledTimes(1);
});
