import { useRef, useState } from "react";
import { Button } from "react-native-paper";

import { hapticCommit, hapticSuccess } from "@/core/ui/haptics";
import { useTranslation } from "@/core/i18n/locale-store";
import { setupVaultPin } from "@/core/vault/vault-store";
import { PIN_LENGTH, PinPad } from "@/ui/pin-pad";
import { PinScreen } from "@/ui/pin-screen";
import { usePinEntry } from "@/ui/use-pin-entry";

import { goToPreviousStep, markPinSetupCompleted } from "../onboarding-store";
import { submitOnboarding } from "../onboarding-submission";

/**
 * The last step, and the only one that changes something outside the device:
 * the code chosen here derives the key every amount is encrypted under, so the
 * budget can only be created once it exists. Same ceremony as
 * `(vault)/vault-setup`, run inside the flow — routing out to the vault group
 * would drop the user into a screen with no way back to the preview.
 */
export function PinSetupStep() {
  const { t } = useTranslation();
  const [isConfirming, setIsConfirming] = useState(false);
  const firstPin = useRef<string | null>(null);

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
      } catch {
        // A failed setup leaves no key behind, so the next attempt starts from
        // the first digit rather than confirming a code that never took.
        restart();
        return t("vault.error");
      }

      markPinSetupCompleted();
      hapticSuccess();
      // Not awaited: its own overlay reports how it goes, and holding the pad
      // busy would leave the user staring at a locked keypad meanwhile.
      void submitOnboarding();
      return null;
    },
  );

  return (
    <PinScreen
      title={t(isConfirming ? "vault.confirmPin" : "vault.setup.title")}
      subtitle={
        isConfirming
          ? t("vault.repeatPin")
          : t("vault.setup.subtitle", { count: PIN_LENGTH })
      }
      footer={
        <Button disabled={isBusy} onPress={() => goToPreviousStep()}>
          {t("onboarding.pin.back")}
        </Button>
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
