import { useRef, useState } from "react";
import { Button } from "react-native-paper";

import { hapticCommit, hapticSuccess } from "@/core/ui/haptics";
import { useSessionStore } from "@/core/auth/session-store";
import { useTranslation } from "@/core/i18n/locale-store";
import { setupVaultPin } from "@/core/vault/vault-store";
import { PIN_LENGTH, PinPad } from "@/ui/pin-pad";
import { PinScreen } from "@/ui/pin-screen";
import { usePinEntry } from "@/ui/use-pin-entry";

/**
 * First run of the vault: the PIN chosen here is what every amount in the
 * account gets encrypted under, so it is typed twice before it counts.
 */
export default function VaultSetupScreen() {
  const { t } = useTranslation();
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
        hapticCommit();
        return null;
      }

      if (candidate !== firstPin.current) {
        restart();
        return t("vault.pinMismatch");
      }

      try {
        await setupVaultPin(candidate);
        hapticSuccess();
        return null;
      } catch {
        // A failed setup leaves nothing behind, so the next attempt starts
        // from the first digit rather than from a confirmation of nothing.
        restart();
        return t("vault.error");
      }
    },
  );

  return (
    <PinScreen
      testID="vault-setup"
      title={t(isConfirming ? "vault.confirmPin" : "vault.setup.title")}
      subtitle={
        isConfirming
          ? t("vault.repeatPin")
          : t("vault.setup.subtitle", { count: PIN_LENGTH })
      }
      footer={
        <Button onPress={() => void signOut()}>{t("common.signOut")}</Button>
      }
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
