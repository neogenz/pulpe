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
  const { pin, setPin, errorMessage, isBusy, isConfirming, restart } =
    usePinCeremony(() => {});

  return (
    <PinScreen
      testID="vault-setup"
      title={t(isConfirming ? "vault.confirmPin" : "vault.setup.title", {
        count: PIN_LENGTH,
      })}
      subtitle={
        isConfirming
          ? t("vault.setup.confirmHint", { count: PIN_LENGTH })
          : t("vault.setup.subtitle", { count: PIN_LENGTH })
      }
      footer={
        <>
          {isConfirming && (
            <Button disabled={isBusy} onPress={restart}>
              {t("vault.setup.changeCode")}
            </Button>
          )}
          <Button
            disabled={isBusy}
            onPress={() => void signOut().catch(() => undefined)}
          >
            {t("common.signOut")}
          </Button>
        </>
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
