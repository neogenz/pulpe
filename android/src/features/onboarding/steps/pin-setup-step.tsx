import { Button } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { PIN_LENGTH, PinPad } from "@/ui/pin-pad";
import { PinScreen } from "@/ui/pin-screen";
import { usePinCeremony } from "@/ui/use-pin-ceremony";

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
  const { pin, setPin, errorMessage, isBusy, isConfirming } = usePinCeremony(
    () => {
      markPinSetupCompleted();
      // Not awaited: its own overlay reports how it goes, and holding the pad
      // busy would leave the user staring at a locked keypad meanwhile.
      void submitOnboarding();
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
