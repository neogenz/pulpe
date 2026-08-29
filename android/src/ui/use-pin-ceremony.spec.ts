import { act, renderHook, waitFor } from "@testing-library/react-native";

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

it("starts over with the mismatch message when the second entry differs", async () => {
  const onConfirmed = jest.fn();
  const { result } = await renderHook(() => usePinCeremony(onConfirmed));

  await act(() => result.current.setPin("1234"));
  await waitFor(() => expect(result.current.isConfirming).toBe(true));
  await act(() => result.current.setPin("9999"));

  await waitFor(() => expect(result.current.isConfirming).toBe(false));
  expect(result.current.errorMessage).toBe("vault.pinMismatch");
  expect(mockedSetup).not.toHaveBeenCalled();
  expect(onConfirmed).not.toHaveBeenCalled();
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
