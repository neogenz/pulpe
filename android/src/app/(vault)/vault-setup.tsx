import { Button } from "react-native-paper";

import { useSessionStore } from "@/core/auth/session-store";
import { useTranslation } from "@/core/i18n/locale-store";
import { PIN_LENGTH, PinPad } from "@/ui/pin-pad";
import { PinScreen } from "@/ui/pin-screen";
import { usePinCeremony } from "@/ui/use-pin-ceremony";

/**
 * First run of the vault: the PIN chosen here is what every amount in the
 * account gets encrypted under, so it is typed twice before it counts.
 */
export default function VaultSetupScreen() {
  const { t } = useTranslation();
  const signOut = useSessionStore((state) => state.signOut);
  // Nothing to do on success: the store flips to `unlocked` and the router
  // leaves this screen on its own.
  const { pin, setPin, errorMessage, isBusy, isConfirming } = usePinCeremony(
    () => {},
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
