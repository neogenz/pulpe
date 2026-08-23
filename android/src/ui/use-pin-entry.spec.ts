import { act, renderHook, waitFor } from "@testing-library/react-native";

import { usePinEntry } from "./use-pin-entry";

jest.mock("@/core/i18n/i18n", () => ({ translate: (key: string) => key }));
jest.mock("@/core/ui/haptics", () => ({ hapticFailure: jest.fn() }));
jest.mock("./pin-pad", () => ({ PIN_LENGTH: 4 }));

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

it("clears an error after three seconds and accepts a new PIN", async () => {
  jest.useFakeTimers();
  const handle = jest
    .fn<Promise<string | null>, [string]>()
    .mockResolvedValueOnce("invalid-pin")
    .mockResolvedValueOnce(null);
  const { result } = await renderHook(() => usePinEntry(handle));

  await act(() => result.current.setPin("1234"));
  expect(result.current.errorMessage).toBe("invalid-pin");

  await act(() => jest.advanceTimersByTimeAsync(2999));
  expect(result.current.errorMessage).toBe("invalid-pin");
  await act(() => jest.advanceTimersByTimeAsync(1));
  expect(result.current.errorMessage).toBeNull();

  await act(() => result.current.setPin("5678"));
  expect(handle).toHaveBeenNthCalledWith(2, "5678");
  expect(result.current).toMatchObject({ pin: "", isBusy: false });
  jest.useRealTimers();
});

it("clears the error timer on unmount", async () => {
  jest.useFakeTimers();
  const clearTimeoutSpy = jest.spyOn(globalThis, "clearTimeout");
  const { result, unmount } = await renderHook(() =>
    usePinEntry(async () => "invalid-pin"),
  );

  await act(() => result.current.setPin("1234"));
  await waitFor(() => expect(result.current.errorMessage).toBe("invalid-pin"));
  expect(clearTimeoutSpy).not.toHaveBeenCalled();

  await unmount();
  expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
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
