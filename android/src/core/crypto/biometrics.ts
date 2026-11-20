import * as SecureStore from "expo-secure-store";

/**
 * Whether biometric unlock can be turned on. The key it guards lives in
 * `expo-secure-store`, which only opens for Class 3 biometrics, so this asks
 * the same question it will. The device's hardware list is not enough: a face
 * sensor declared there is usually Class 2, and Android then prompts for the
 * fingerprint. Android picks the sensor, so the setting never names one.
 */
export function canUseBiometricUnlock(): boolean {
  return SecureStore.canUseBiometricAuthentication();
}
