import { act, renderHook, waitFor } from "@testing-library/react-native";

import { hapticFailure } from "@/core/ui/haptics";

import { usePinEntry } from "./use-pin-entry";

jest.mock("@/core/i18n/i18n", () => ({ translate: (key: string) => key }));
jest.mock("@/core/ui/haptics", () => ({ hapticFailure: jest.fn() }));
jest.mock("./pin-pad", () => ({ PIN_LENGTH: 4 }));

const mockedHapticFailure = jest.mocked(hapticFailure);

it("submits the fourth digit once while validation is in flight", async () => {
  let finish!: (message: string | null) => void;
  const handle = jest.fn(
    () => new Promise<string | null>((resolve) => (finish = resolve)),
  );
  const { result } = await renderHook(() => usePinEntry(handle));

  await act(() => result.current.setPin("1234"));
  await waitFor(() => expect(result.current.isBusy).toBe(true));
  await act(() => result.current.setPin("5678"));
  expect(handle).toHaveBeenCalledTimes(1);

  await act(async () => finish(null));
  expect(result.current).toMatchObject({ pin: "", isBusy: false });
});

it("clears a returned error and its timer on unmount", async () => {
  jest.useFakeTimers();
  const clearTimeoutSpy = jest.spyOn(globalThis, "clearTimeout");
  const { result, unmount } = await renderHook(() =>
    usePinEntry(async () => "invalid-pin"),
  );

  await act(() => result.current.setPin("1234"));
  await waitFor(() => expect(result.current.errorMessage).toBe("invalid-pin"));
  expect(mockedHapticFailure).toHaveBeenCalledTimes(1);

  await unmount();
  expect(clearTimeoutSpy).toHaveBeenCalled();
  clearTimeoutSpy.mockRestore();
  jest.useRealTimers();
});

it("turns a rejected request into a recoverable translated error", async () => {
  const { result } = await renderHook(() =>
    usePinEntry(async () => Promise.reject(new Error("offline"))),
  );

  await act(() => result.current.setPin("1234"));

  await waitFor(() => expect(result.current.errorMessage).toBe("vault.error"));
  expect(result.current).toMatchObject({ pin: "", isBusy: false });
});
