import * as LocalAuthentication from "expo-local-authentication";

/**
 * What this device can actually offer, named the way its own settings name it —
 * mirrors `BiometricService.biometryDisplayName` on iOS. `null` means the
 * option must not be shown at all: either there is no sensor, or nothing is
 * enrolled on it, and offering a switch that can only fail is worse than
 * offering nothing.
 */
export type BiometricKind = "face" | "fingerprint" | "generic";

export async function describeBiometrics(): Promise<BiometricKind | null> {
  const [hasHardware, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  if (!hasHardware || !isEnrolled) return null;

  if (
    types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
  ) {
    return "face";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return "fingerprint";
  }
  return "generic";
}
