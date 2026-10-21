import { act, renderHook, waitFor } from "@testing-library/react-native";

import { BackHandler } from "react-native";

import { setupVaultPin } from "@/core/vault/vault-store";

import { usePinCeremony } from "./use-pin-ceremony";

jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/core/i18n/i18n", () => ({ translate: (key: string) => key }));
jest.mock("@/core/ui/haptics", () => ({
  hapticCommit: jest.fn(),
  hapticFailure: jest.fn(),
  hapticSuccess: jest.fn(),
}));
jest.mock("@/core/vault/vault-store", () => ({ setupVaultPin: jest.fn() }));
jest.mock("./pin-pad", () => ({ PIN_LENGTH: 4 }));

const mockedSetup = jest.mocked(setupVaultPin);

beforeEach(() => jest.clearAllMocks());

it("sets the PIN up once both entries agree", async () => {
  mockedSetup.mockResolvedValue(undefined);
  const onConfirmed = jest.fn();
  const { result } = await renderHook(() => usePinCeremony(onConfirmed));

  await act(() => result.current.setPin("1234"));
  await waitFor(() => expect(result.current.isConfirming).toBe(true));
  expect(mockedSetup).not.toHaveBeenCalled();

  await act(() => result.current.setPin("1234"));

  await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1));
  expect(mockedSetup).toHaveBeenCalledTimes(1);
  expect(mockedSetup).toHaveBeenCalledWith("1234");
  expect(result.current.errorMessage).toBeNull();
});

it("keeps the first PIN after a mismatch and accepts only its confirmation", async () => {
  const onConfirmed = jest.fn();
  const { result } = await renderHook(() => usePinCeremony(onConfirmed));

  await act(() => result.current.setPin("1234"));
  await waitFor(() => expect(result.current.isConfirming).toBe(true));
  await act(() => result.current.setPin("9999"));

  await waitFor(() =>
    expect(result.current.errorMessage).toBe("vault.setup.mismatch"),
  );
  expect(result.current.isConfirming).toBe(true);
  expect(result.current.pin).toBe("");
  expect(mockedSetup).not.toHaveBeenCalled();
  expect(onConfirmed).not.toHaveBeenCalled();

  await act(() => result.current.setPin("1234"));
  await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1));
  expect(mockedSetup).toHaveBeenCalledWith("1234");
});

it("starts over with the vault error when the server refuses the setup", async () => {
  mockedSetup.mockRejectedValue(new Error("refused"));
  const onConfirmed = jest.fn();
  const { result } = await renderHook(() => usePinCeremony(onConfirmed));

  await act(() => result.current.setPin("1234"));
  await waitFor(() => expect(result.current.isConfirming).toBe(true));
  await act(() => result.current.setPin("1234"));

  await waitFor(() => expect(result.current.errorMessage).toBe("vault.error"));
  expect(result.current.isConfirming).toBe(false);
  expect(onConfirmed).not.toHaveBeenCalled();
});

it("keeps mismatch feedback until the next digit", async () => {
  jest.useFakeTimers();
  try {
    const { result } = await renderHook(() => usePinCeremony(jest.fn()));
    await act(() => result.current.setPin("1234"));
    await act(() => result.current.setPin("9999"));
    await act(() => jest.advanceTimersByTimeAsync(5000));
    expect(result.current.errorMessage).toBe("vault.setup.mismatch");
    await act(() => result.current.setPin("1"));
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.isConfirming).toBe(true);
  } finally {
    jest.useRealTimers();
  }
});

it.each(["link", "system back"])(
  "forgets both entries via %s",
  async (action) => {
    mockedSetup.mockResolvedValue(undefined);
    let back: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
    const subscription = jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation((_event, handler) => {
        back = handler;
        return { remove: jest.fn() };
      });
    try {
      const { result } = await renderHook(() => usePinCeremony(jest.fn()));
      await act(() => result.current.setPin("1234"));
      await act(() => result.current.setPin("12"));
      await act(() => {
        if (action === "link") result.current.restart();
        else expect(back?.({} as never)).toBe(true);
      });
      expect(result.current).toMatchObject({
        pin: "",
        isConfirming: false,
        errorMessage: null,
      });
      await act(() => result.current.setPin("5678"));
      expect(mockedSetup).not.toHaveBeenCalled();
      await act(() => result.current.setPin("5678"));
      expect(mockedSetup).toHaveBeenCalledWith("5678");
    } finally {
      subscription.mockRestore();
    }
  },
);

it("blocks system back while the key is being created", async () => {
  let finish!: () => void;
  mockedSetup.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  let back: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
  const subscription = jest
    .spyOn(BackHandler, "addEventListener")
    .mockImplementation((_event, handler) => {
      back = handler;
      return { remove: jest.fn() };
    });
  try {
    const { result } = await renderHook(() => usePinCeremony(jest.fn()));
    await act(() => result.current.setPin("1234"));
    await act(() => result.current.setPin("1234"));
    expect(result.current.isBusy).toBe(true);
    await act(() => expect(back?.({} as never)).toBe(true));
    expect(result.current.isConfirming).toBe(true);
    await act(async () => finish());
  } finally {
    subscription.mockRestore();
  }
});
