import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import SecuritySettingsScreen from "@/app/(main)/settings/security";

const mockInvalidCredentials = new Error("invalid credentials");
const mockBiometricKind = { value: "fingerprint" as string | null };
const mockProfile = { data: { email: "max@example.com" } };
const mockSignOut = jest.fn(async () => undefined);
const mockSession = {
  user: { email: "session@example.com" },
  signOut: mockSignOut,
};
const mockVault = { isBiometricAvailable: false };
const mockDelete = { mutate: jest.fn(), isPending: false };
const mockEnableBiometrics = jest.fn(async () => true);
const mockDisableBiometrics = jest.fn(async () => undefined);
const mockLockVault = jest.fn(async () => undefined);
const mockRenewRecoveryKey = jest.fn(async () => undefined);
const mockVerifyPassword = jest.fn(
  async (_email: string, _password: string) => undefined,
);
const mockUpdatePassword = jest.fn(async (_password: string) => undefined);

jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: mockBiometricKind.value }),
}));
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn() },
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}));
jest.mock("@expo/vector-icons/MaterialCommunityIcons", () => () => null);
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/core/auth/auth-error", () => ({
  isInvalidCredentials: (error: unknown) => error === mockInvalidCredentials,
}));
jest.mock("@/core/auth/supabase", () => ({
  updatePassword: (password: string) => mockUpdatePassword(password),
  verifyPassword: (email: string, password: string) =>
    mockVerifyPassword(email, password),
}));
jest.mock("@/core/auth/session-store", () => ({
  useSessionStore: (selector: (state: typeof mockSession) => unknown) =>
    selector(mockSession),
}));
jest.mock("@/core/vault/vault-store", () => ({
  disableVaultBiometrics: () => mockDisableBiometrics(),
  enableVaultBiometrics: () => mockEnableBiometrics(),
  lockVault: () => mockLockVault(),
  renewRecoveryKey: () => mockRenewRecoveryKey(),
  useVaultStore: (selector: (state: typeof mockVault) => unknown) =>
    selector(mockVault),
}));
jest.mock("@/features/account/account-queries", () => ({
  useDeleteAccount: () => mockDelete,
  useUserProfile: () => mockProfile,
}));
jest.mock("@/core/crypto/biometrics", () => ({
  describeBiometrics: jest.fn(),
}));
jest.mock("@/core/ui/haptics", () => ({ hapticSuccess: jest.fn() }));
jest.mock("@/core/ui/theme", () => ({
  AUTO_LOCK_DELAY_MINUTES: 5,
  ICON_SIZE: { sm: 16 },
  SPACING: { xxs: 2, sm: 8, md: 16, lg: 24, xxl: 32 },
}));
jest.mock("@/core/ui/scheme-colors", () => ({
  useFinancialColors: () => ({
    destructive: "red",
    destructiveContainer: "pink",
  }),
}));
jest.mock("@/core/ui/screen-app-bar", () => ({
  ScreenAppBar: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/core/ui/eyebrow", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    Eyebrow: ({ children }: { children: React.ReactNode }) => (
      <Text>{children}</Text>
    ),
  };
});
jest.mock("@/core/ui/card", () => {
  const { View } = jest.requireActual("react-native");
  const Card = ({ children }: { children: React.ReactNode }) => (
    <View>{children}</View>
  );
  Card.Content = View;
  return { Card };
});
jest.mock("@/core/ui/field-error", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    FieldError: ({ children }: { children: React.ReactNode }) => (
      <Text>{children}</Text>
    ),
  };
});
jest.mock("@/core/ui/notice", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    Notice: ({
      visible,
      children,
    }: {
      visible: boolean;
      children: React.ReactNode;
    }) => (visible ? <Text>{children}</Text> : null),
  };
});
jest.mock("@/core/ui/sheet", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    FormModal: ({
      isVisible,
      title,
      children,
      footer,
      onDismiss,
      isBusy,
    }: {
      isVisible: boolean;
      title: string;
      children: React.ReactNode;
      footer: React.ReactNode;
      onDismiss: () => void;
      isBusy: boolean;
    }) =>
      isVisible ? (
        <View>
          <Text>{title}</Text>
          {children}
          {footer}
          <Pressable
            accessibilityLabel="dismiss-form"
            disabled={isBusy}
            onPress={onDismiss}
          />
        </View>
      ) : null,
  };
});
jest.mock("@/features/account/components/settings-section", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    SettingsSection: ({
      title,
      children,
    }: {
      title: string;
      children: React.ReactNode;
    }) => (
      <View>
        <Text>{title}</Text>
        {children}
      </View>
    ),
    SettingsRow: ({
      title,
      onPress,
      isDisabled,
    }: {
      title: string;
      onPress: () => void;
      isDisabled?: boolean;
    }) => (
      <Pressable onPress={onPress} disabled={isDisabled}>
        <Text>{title}</Text>
      </Pressable>
    ),
  };
});
jest.mock("@/features/account/components/verify-recovery-key-sheet", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    VerifyRecoveryKeySheet: ({ onVerified }: { onVerified: () => void }) => (
      <Pressable onPress={onVerified}>
        <Text>verify-recovery</Text>
      </Pressable>
    ),
  };
});
jest.mock("react-native-paper", () => {
  const { Pressable, Text, TextInput, View } =
    jest.requireActual("react-native");
  const Dialog = ({
    visible,
    children,
  }: {
    visible: boolean;
    children: React.ReactNode;
  }) => (visible ? <View>{children}</View> : null);
  Object.assign(Dialog, {
    Icon: () => null,
    Title: ({ children }: { children: React.ReactNode }) => (
      <Text>{children}</Text>
    ),
    Content: View,
    Actions: View,
  });
  return {
    Appbar: {
      BackAction: ({ onPress }: { onPress: () => void }) => (
        <Pressable accessibilityLabel="back" onPress={onPress} />
      ),
      Content: ({ title }: { title: string }) => <Text>{title}</Text>,
    },
    Button: ({
      children,
      onPress,
      disabled,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      disabled?: boolean;
    }) => (
      <Pressable onPress={onPress} disabled={disabled}>
        <Text>{children}</Text>
      </Pressable>
    ),
    Dialog,
    Portal: ({ children }: { children: React.ReactNode }) => children,
    Switch: ({
      value,
      disabled,
      onValueChange,
      accessibilityLabel,
    }: {
      value: boolean;
      disabled: boolean;
      onValueChange: (value: boolean) => void;
      accessibilityLabel: string;
    }) => (
      <Pressable
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        onPress={() => onValueChange(!value)}
      />
    ),
    Text,
    TextInput: ({
      label,
      value,
      onChangeText,
    }: {
      label: string;
      value: string;
      onChangeText: (value: string) => void;
    }) => (
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
      />
    ),
    useTheme: () => ({
      colors: {
        background: "white",
        error: "orange",
        onError: "white",
        onSurface: "black",
        onSurfaceVariant: "gray",
        primary: "purple",
      },
    }),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockBiometricKind.value = "fingerprint";
  mockProfile.data = { email: "max@example.com" };
  mockVault.isBiometricAvailable = false;
  mockDelete.isPending = false;
  mockEnableBiometrics.mockResolvedValue(true);
  mockDisableBiometrics.mockResolvedValue(undefined);
  mockVerifyPassword.mockResolvedValue(undefined);
  mockUpdatePassword.mockResolvedValue(undefined);
});

it("opens PIN, locks immediately and changes a verified password", async () => {
  const view = await render(<SecuritySettingsScreen />);
  await fireEvent.press(view.getByText("settings.security.pinTitle"));
  expect(router.push).toHaveBeenCalledWith("/settings/change-pin");
  await fireEvent.press(view.getByText("settings.security.lockTitle"));
  expect(mockLockVault).toHaveBeenCalledTimes(1);

  await fireEvent.press(view.getByText("common.password"));
  await fireEvent.changeText(
    view.getByLabelText("settings.security.changePasswordCurrent"),
    "old-password",
  );
  await fireEvent.changeText(
    view.getByLabelText("settings.security.changePasswordNew"),
    "StrongPassword42!",
  );
  await fireEvent.changeText(
    view.getByLabelText("settings.security.changePasswordConfirm"),
    "StrongPassword42!",
  );
  await fireEvent.press(
    view.getByText("settings.security.changePasswordAction"),
  );
  await waitFor(() =>
    expect(mockVerifyPassword).toHaveBeenCalledWith(
      "max@example.com",
      "old-password",
    ),
  );
  expect(mockUpdatePassword).toHaveBeenCalledWith("StrongPassword42!");
  expect(view.getByText("settings.security.passwordChanged")).toBeTruthy();
});

it("keeps password changes safe when current credentials are rejected", async () => {
  mockVerifyPassword.mockRejectedValueOnce(mockInvalidCredentials);
  const view = await render(<SecuritySettingsScreen />);
  await fireEvent.press(view.getByText("common.password"));
  await fireEvent.changeText(
    view.getByLabelText("settings.security.changePasswordCurrent"),
    "wrong",
  );
  await fireEvent.changeText(
    view.getByLabelText("settings.security.changePasswordNew"),
    "StrongPassword42!",
  );
  await fireEvent.changeText(
    view.getByLabelText("settings.security.changePasswordConfirm"),
    "StrongPassword42!",
  );
  await fireEvent.press(
    view.getByText("settings.security.changePasswordAction"),
  );

  expect(
    await view.findByText("settings.security.changePasswordCurrentIncorrect"),
  ).toBeTruthy();
  expect(mockUpdatePassword).not.toHaveBeenCalled();
  expect(mockSignOut).not.toHaveBeenCalled();
});

it("enables biometrics and reports a recoverable authentication failure", async () => {
  const view = await render(<SecuritySettingsScreen />);
  await fireEvent.press(
    view.getByLabelText("settings.security.biometric.fingerprint"),
  );
  expect(
    await view.findByText("settings.security.biometricEnabled"),
  ).toBeTruthy();

  mockEnableBiometrics.mockRejectedValueOnce(new Error("cancelled"));
  await fireEvent.press(
    view.getByLabelText("settings.security.biometric.fingerprint"),
  );
  expect(
    await view.findByText("settings.security.biometricEnableError"),
  ).toBeTruthy();
});

it("disables biometrics only after an explicit confirmation", async () => {
  mockVault.isBiometricAvailable = true;
  const view = await render(<SecuritySettingsScreen />);
  await fireEvent.press(
    view.getByLabelText("settings.security.biometric.fingerprint"),
  );
  expect(mockDisableBiometrics).not.toHaveBeenCalled();
  await fireEvent.press(
    view.getByText("settings.security.biometricDisableAction"),
  );
  await waitFor(() => expect(mockDisableBiometrics).toHaveBeenCalledTimes(1));
  expect(view.getByText("settings.security.biometricDisabled")).toBeTruthy();
});

it("signs out exactly once after confirmed account deletion", async () => {
  const view = await render(<SecuritySettingsScreen />);
  await fireEvent.press(view.getByText("settings.security.deleteAccountTitle"));
  await fireEvent.press(view.getByText("common.delete"));
  expect(mockDelete.mutate).toHaveBeenCalledTimes(1);
  const callbacks = mockDelete.mutate.mock.calls[0][1] as {
    onSuccess: () => void;
  };
  callbacks.onSuccess();
  expect(mockSignOut).toHaveBeenCalledTimes(1);

  mockDelete.isPending = true;
  await view.rerender(<SecuritySettingsScreen />);
  await fireEvent.press(view.getByText("common.delete"));
  expect(mockDelete.mutate).toHaveBeenCalledTimes(1);
});

it("closes a rejected deletion with an error and allows a retry", async () => {
  const view = await render(<SecuritySettingsScreen />);
  await fireEvent.press(view.getByText("settings.security.deleteAccountTitle"));
  await fireEvent.press(view.getByText("common.delete"));
  const callbacks = mockDelete.mutate.mock.calls[0][1] as {
    onError: () => void;
  };
  await act(() => callbacks.onError());
  expect(view.getByText("settings.security.deleteAccountError")).toBeTruthy();
  expect(mockSignOut).not.toHaveBeenCalled();

  await fireEvent.press(view.getByText("settings.security.deleteAccountTitle"));
  await fireEvent.press(view.getByText("common.delete"));
  expect(mockDelete.mutate).toHaveBeenCalledTimes(2);
});
