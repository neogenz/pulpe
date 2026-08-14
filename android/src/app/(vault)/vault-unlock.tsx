import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Link } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Button, useTheme } from "react-native-paper";

import { normalizeApiError } from "@/core/api/api-error";
import { useSessionStore } from "@/core/auth/session-store";
import { useRipple } from "@/core/ui/ripple";
import { ICON_SIZE, RADIUS, SPACING } from "@/core/ui/theme";
import {
  unlockVaultWithBiometrics,
  unlockVaultWithPin,
  useVaultStore,
} from "@/core/vault/vault-store";
import { PinPad } from "@/ui/pin-pad";
import { PinScreen } from "@/ui/pin-screen";
import { usePinEntry } from "@/ui/use-pin-entry";

export default function VaultUnlockScreen() {
  const theme = useTheme();
  const ripple = useRipple();
  const isBiometricAvailable = useVaultStore(
    (state) => state.isBiometricAvailable,
  );
  const signOut = useSessionStore((state) => state.signOut);
  const [biometricError, setBiometricError] = useState<string | null>(null);

  const { pin, setPin, errorMessage, isBusy } = usePinEntry(
    async (candidate) => {
      await unlockVaultWithPin(candidate);
      return null;
    },
  );

  async function promptBiometric() {
    setBiometricError(null);
    try {
      await unlockVaultWithBiometrics();
    } catch (error) {
      setBiometricError(normalizeApiError(error).message);
    }
  }

  // Once per mount: a returning user should meet the sensor, not the keypad.
  // Dismissing it falls through to the PIN, which is always available.
  const hasPrompted = useRef(false);
  useEffect(() => {
    if (!isBiometricAvailable || hasPrompted.current) return;
    hasPrompted.current = true;
    void promptBiometric();
  }, [isBiometricAvailable]);

  return (
    <PinScreen
      title="Ton code"
      subtitle="Il déverrouille tes montants"
      footer={
        <>
          <Link href="/vault-recover" asChild>
            <Button>Code oublié ?</Button>
          </Link>
          <Button onPress={() => void signOut()}>Se déconnecter</Button>
        </>
      }
    >
      <PinPad
        value={pin}
        onChange={setPin}
        errorMessage={errorMessage ?? biometricError}
        isDisabled={isBusy}
        accessory={
          isBiometricAvailable ? (
            <Pressable
              onPress={() => void promptBiometric()}
              android_ripple={ripple}
              accessibilityRole="button"
              accessibilityLabel="Déverrouiller avec la biométrie"
              style={styles.biometric}
            >
              <MaterialCommunityIcons
                name="fingerprint"
                size={ICON_SIZE.xl}
                color={theme.colors.primary}
              />
            </Pressable>
          ) : null
        }
      />
    </PinScreen>
  );
}

const styles = StyleSheet.create({
  biometric: {
    flex: 1,
    width: "100%",
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xs,
  },
});
