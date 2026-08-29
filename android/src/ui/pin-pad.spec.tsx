import { fireEvent, render } from "@testing-library/react-native";

import { hapticSelection } from "@/core/ui/haptics";

import { PinPad } from "./pin-pad";

jest.mock("@/core/ui/haptics", () => ({ hapticSelection: jest.fn() }));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values === undefined ? key : `${key} ${JSON.stringify(values)}`,
  }),
}));

beforeEach(() => jest.clearAllMocks());

it("appends a digit and tells the finger it landed", async () => {
  const onChange = jest.fn();
  const view = await render(<PinPad value="12" onChange={onChange} />);

  await fireEvent.press(view.getByLabelText("3"));

  expect(onChange).toHaveBeenCalledWith("123");
  expect(hapticSelection).toHaveBeenCalledTimes(1);
  expect(
    view.getByLabelText('vault.pinProgress {"filled":2,"total":4}').props
      .accessibilityRole,
  ).toBe("progressbar");
});

it("deletes the last digit and takes nothing past four", async () => {
  const onChange = jest.fn();
  const view = await render(<PinPad value="1234" onChange={onChange} />);

  await fireEvent.press(view.getByLabelText("5"));
  expect(onChange).not.toHaveBeenCalled();

  await fireEvent.press(view.getByLabelText("common.delete"));
  expect(onChange).toHaveBeenCalledWith("123");
});

it("shows the message under the dots", async () => {
  const view = await render(
    <PinPad value="" onChange={jest.fn()} errorMessage="Code incorrect" />,
  );

  expect(view.getByText("Code incorrect")).toBeTruthy();
});

it("ignores every key while disabled, and says so", async () => {
  const onChange = jest.fn();
  const view = await render(
    <PinPad value="1" onChange={onChange} isDisabled />,
  );

  await fireEvent.press(view.getByLabelText("3"));
  await fireEvent.press(view.getByLabelText("common.delete"));

  expect(onChange).not.toHaveBeenCalled();
  expect(hapticSelection).not.toHaveBeenCalled();
  expect(view.getByLabelText("3").props.accessibilityState).toEqual(
    expect.objectContaining({ disabled: true }),
  );
});
