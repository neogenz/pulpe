import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import { Button } from "react-native-paper";

import { normalizeApiError } from "@/core/api/api-error";
import { useSessionStore } from "@/core/auth/session-store";
import { setupVaultPin } from "@/core/vault/vault-store";
import { PIN_LENGTH, PinPad } from "@/ui/pin-pad";
import { PinScreen } from "@/ui/pin-screen";
import { usePinEntry } from "@/ui/use-pin-entry";

/**
 * First run of the vault: the PIN chosen here is what every amount in the
 * account gets encrypted under, so it is typed twice before it counts.
 */
export default function VaultSetupScreen() {
  const [isConfirming, setIsConfirming] = useState(false);
  const firstPin = useRef<string | null>(null);
  const signOut = useSessionStore((state) => state.signOut);

  function restart() {
    firstPin.current = null;
    setIsConfirming(false);
  }

  const { pin, setPin, errorMessage, isBusy } = usePinEntry(
    async (candidate) => {
      if (firstPin.current === null) {
        firstPin.current = candidate;
        setIsConfirming(true);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
        return null;
      }

      if (candidate !== firstPin.current) {
        restart();
        return "Les codes ne correspondent pas";
      }

      try {
        await setupVaultPin(candidate);
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        return null;
      } catch (error) {
        // A failed setup leaves nothing behind, so the next attempt starts
        // from the first digit rather than from a confirmation of nothing.
        restart();
        return normalizeApiError(error).message;
      }
    },
  );

  return (
    <PinScreen
      title={isConfirming ? "Confirme ton code" : "Choisis ton code"}
      subtitle={
        isConfirming
          ? "Saisis-le une seconde fois"
          : `${PIN_LENGTH} chiffres — tes montants sont chiffrés avec ce code`
      }
      footer={<Button onPress={() => void signOut()}>Se déconnecter</Button>}
    >
      <PinPad
        value={pin}
        onChange={setPin}
        errorMessage={errorMessage}
        isDisabled={isBusy}
      />
    </PinScreen>
  );
}
