import * as Haptics from "expo-haptics";

import {
  hapticCommit,
  hapticFailure,
  hapticSelection,
  hapticSuccess,
} from "./haptics";

jest.mock("expo-haptics", () => ({
  ...jest.requireActual("expo-haptics/src/Haptics.types"),
  performAndroidHapticsAsync: jest.fn(async () => undefined),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
}));

const perform = jest.mocked(Haptics.performAndroidHapticsAsync);

/** Lets the rejected first attempt reach its fallback. */
async function settle() {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

beforeEach(() => perform.mockReset().mockResolvedValue(undefined));

it("plays the constants Android's own controls use, never a Vibrator waveform", async () => {
  hapticSelection();
  hapticCommit();
  hapticSuccess();
  hapticFailure();
  await settle();

  expect(perform.mock.calls.map(([type]) => type)).toEqual([
    "segment-tick",
    "virtual-key",
    "confirm",
    "reject",
  ]);
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
  expect(Haptics.notificationAsync).not.toHaveBeenCalled();
});

it("falls back on an older Android that does not know the constant", async () => {
  perform.mockRejectedValueOnce(new Error("HapticsNotSupportedException"));

  hapticSuccess();
  await settle();

  expect(perform.mock.calls.map(([type]) => type)).toEqual([
    "confirm",
    "virtual-key",
  ]);
});

it("swallows a haptic that fails outright", async () => {
  perform.mockRejectedValue(new Error("no actuator"));

  expect(() => hapticFailure()).not.toThrow();
  await settle();

  expect(perform).toHaveBeenCalledTimes(2);
});
