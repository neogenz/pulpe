import { fireEvent, render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";

import { PointCircle } from "./point-circle";

jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ locale: "fr", t: (key: string) => key }),
}));
jest.mock("@/core/ui/haptics", () => ({ hapticSelection: jest.fn() }));

async function renderCircle(isSyncing: boolean) {
  const onToggle = jest.fn();
  const view = await render(
    <PaperProvider>
      <PointCircle
        isChecked
        color="#B35800"
        icon="arrow-up"
        isSyncing={isSyncing}
        label="Loyer"
        onToggle={onToggle}
      />
    </PaperProvider>,
  );
  return { onToggle, circle: view.getByRole("checkbox") };
}

afterEach(() => jest.useRealTimers());

/**
 * The server flips whatever state it holds, so the tap that takes a pointing
 * back has to reach it even while the first one is still on its way — it used
 * to be swallowed for the whole round trip, and the row stayed pointed.
 */
it("takes a second, deliberate tap while the first is still in flight", async () => {
  jest.useFakeTimers({ now: 1_000_000 });
  const { onToggle, circle } = await renderCircle(true);

  expect(circle).not.toBeDisabled();
  expect(circle.props.accessibilityState).toMatchObject({ busy: true });

  await fireEvent.press(circle);
  jest.setSystemTime(1_000_000 + 800);
  await fireEvent.press(circle);

  expect(onToggle).toHaveBeenCalledTimes(2);
});

it("drops the bounce of one finger, which is not a second decision", async () => {
  jest.useFakeTimers({ now: 2_000_000 });
  const { onToggle, circle } = await renderCircle(false);

  await fireEvent.press(circle);
  jest.setSystemTime(2_000_000 + 120);
  await fireEvent.press(circle);

  expect(onToggle).toHaveBeenCalledTimes(1);
});
