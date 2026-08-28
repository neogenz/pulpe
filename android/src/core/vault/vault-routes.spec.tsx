import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { API_ERROR_CODES } from "pulpe-shared";

import VaultRecoverScreen from "@/app/(vault)/vault-recover";
import VaultSetupScreen from "@/app/(vault)/vault-setup";
import VaultUnlockScreen from "@/app/(vault)/vault-unlock";
import { normalizeApiError } from "@/core/api/api-error";
import {
  recoverVaultWithKey,
  setupVaultPin,
  unlockVaultWithBiometrics,
  unlockVaultWithPin,
} from "@/core/vault/vault-store";

const mockSignOut = jest.fn();
const mockVault = { isBiometricAvailable: false };

jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  router: { back: jest.fn() },
}));
jest.mock("@expo/vector-icons/MaterialCommunityIcons", () => () => null);
jest.mock("@/core/auth/session-store", () => ({
  useSessionStore: (
    selector: (state: { signOut: typeof mockSignOut }) => unknown,
  ) => selector({ signOut: mockSignOut }),
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/core/ui/haptics", () => ({
  hapticCommit: jest.fn(),
  hapticFailure: jest.fn(),
  hapticSuccess: jest.fn(),
}));
jest.mock("@/core/ui/ripple", () => ({ useRipple: () => undefined }));
jest.mock("@/core/api/api-error", () => ({
  normalizeApiError: jest.fn(),
}));
jest.mock("@/core/vault/vault-store", () => ({
  recoverVaultWithKey: jest.fn(),
  setupVaultPin: jest.fn(),
  unlockVaultWithBiometrics: jest.fn(),
  unlockVaultWithPin: jest.fn(),
  useVaultStore: (selector: (state: typeof mockVault) => unknown) =>
    selector(mockVault),
}));
jest.mock("@/ui/pin-screen", () => {
  const { Text, View } = jest.requireActual("react-native");
  return {
    PinScreen: ({
      title,
      children,
      footer,
    }: {
      title: string;
      children: React.ReactNode;
      footer?: React.ReactNode;
    }) => (
      <View>
        <Text>{title}</Text>
        {children}
        {footer}
      </View>
    ),
  };
});
jest.mock("@/ui/pin-pad", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    PIN_LENGTH: 4,
    PinPad: ({
      onChange,
      errorMessage,
      isDisabled,
      accessory,
    }: {
      onChange: (pin: string) => void;
      errorMessage?: string | null;
      isDisabled?: boolean;
      accessory?: React.ReactNode;
    }) => (
      <View>
        {["1234", "5678"].map((pin) => (
          <Pressable
            key={pin}
            onPress={() => onChange(pin)}
            disabled={isDisabled}
          >
            <Text>{`pin:${pin}`}</Text>
          </Pressable>
        ))}
        <Text>{errorMessage}</Text>
        {accessory}
      </View>
    ),
  };
});

const mockedNormalize = jest.mocked(normalizeApiError);
const mockedRecover = jest.mocked(recoverVaultWithKey);
const mockedSetup = jest.mocked(setupVaultPin);
const mockedBiometrics = jest.mocked(unlockVaultWithBiometrics);
const mockedUnlock = jest.mocked(unlockVaultWithPin);
const COMPLETE_KEY = "A".repeat(52);

beforeEach(() => {
  jest.clearAllMocks();
  mockVault.isBiometricAvailable = false;
  mockedRecover.mockResolvedValue(undefined);
  mockedSetup.mockResolvedValue(undefined);
  mockedBiometrics.mockResolvedValue(true);
  mockedUnlock.mockResolvedValue(undefined);
  mockedNormalize.mockReturnValue({ status: 400, code: null } as never);
});

it("unlocks with PIN, biometrics and a recoverable biometric retry", async () => {
  mockVault.isBiometricAvailable = true;
  mockedBiometrics.mockRejectedValueOnce(new Error("dismissed"));
  const view = await render(<VaultUnlockScreen />);

  await waitFor(() => expect(mockedBiometrics).toHaveBeenCalledTimes(1));
  expect(view.getByText("vault.error")).toBeTruthy();
  await fireEvent.press(view.getByText("pin:1234"));
  await waitFor(() => expect(mockedUnlock).toHaveBeenCalledWith("1234"));
  await fireEvent.press(view.getByLabelText("vault.unlock.biometric"));
  expect(mockedBiometrics).toHaveBeenCalledTimes(2);
});

it("requires matching setup PINs and remains retryable after setup failure", async () => {
  mockedSetup.mockRejectedValueOnce(new Error("offline"));
  const view = await render(<VaultSetupScreen />);

  await fireEvent.press(view.getByText("pin:1234"));
  await waitFor(() => expect(view.getByText("vault.confirmPin")).toBeTruthy());
  await fireEvent.press(view.getByText("pin:5678"));
  await waitFor(() => expect(view.getByText("vault.pinMismatch")).toBeTruthy());

  await fireEvent.press(view.getByText("pin:1234"));
  await waitFor(() => expect(view.getByText("vault.confirmPin")).toBeTruthy());
  await fireEvent.press(view.getByText("pin:1234"));
  await waitFor(() => expect(view.getByText("vault.error")).toBeTruthy());
  expect(mockedSetup).toHaveBeenCalledTimes(1);

  await fireEvent.press(view.getByText("pin:1234"));
  await waitFor(() => expect(view.getByText("vault.confirmPin")).toBeTruthy());
  await fireEvent.press(view.getByText("pin:1234"));
  await waitFor(() => expect(mockedSetup).toHaveBeenCalledTimes(2));
});

it("recovers with a complete key and a confirmed new PIN", async () => {
  const view = await render(<VaultRecoverScreen />);
  await fireEvent.changeText(
    view.getByPlaceholderText("vault.recovery.placeholder"),
    COMPLETE_KEY,
  );
  await fireEvent.press(view.getByText("common.continue"));
  await fireEvent.press(view.getByText("pin:1234"));
  await waitFor(() => expect(view.getByText("vault.confirmPin")).toBeTruthy());
  await fireEvent.press(view.getByText("pin:1234"));

  await waitFor(() =>
    expect(mockedRecover).toHaveBeenCalledWith(COMPLETE_KEY, "1234"),
  );
});

it("returns to the key after an API rejection and signs out on unauthorized", async () => {
  mockedRecover.mockRejectedValueOnce(new Error("invalid"));
  mockedNormalize.mockReturnValueOnce({
    status: 400,
    code: API_ERROR_CODES.RECOVERY_KEY_INVALID,
  } as never);
  const rejected = await render(<VaultRecoverScreen />);
  await fireEvent.changeText(
    rejected.getByPlaceholderText("vault.recovery.placeholder"),
    COMPLETE_KEY,
  );
  await fireEvent.press(rejected.getByText("common.continue"));
  await fireEvent.press(rejected.getByText("pin:1234"));
  await waitFor(() =>
    expect(rejected.getByText("vault.confirmPin")).toBeTruthy(),
  );
  await fireEvent.press(rejected.getByText("pin:1234"));
  await waitFor(() =>
    expect(rejected.getByText("vault.recovery.rejected")).toBeTruthy(),
  );

  mockedRecover.mockRejectedValueOnce(new Error("expired"));
  mockedNormalize.mockReturnValueOnce({ status: 401, code: null } as never);
  const unauthorized = await render(<VaultRecoverScreen />);
  await fireEvent.changeText(
    unauthorized.getByPlaceholderText("vault.recovery.placeholder"),
    COMPLETE_KEY,
  );
  await fireEvent.press(unauthorized.getByText("common.continue"));
  await fireEvent.press(unauthorized.getByText("pin:1234"));
  await waitFor(() =>
    expect(unauthorized.getByText("vault.confirmPin")).toBeTruthy(),
  );
  await fireEvent.press(unauthorized.getByText("pin:1234"));
  await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
});
