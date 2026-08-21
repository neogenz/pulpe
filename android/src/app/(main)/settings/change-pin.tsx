import { router } from "expo-router";
import { API_ERROR_CODES } from "pulpe-shared";
import { useRef, useState } from "react";
import { Button } from "react-native-paper";

import { hapticCommit, hapticSuccess } from "@/core/ui/haptics";
import { isApiError } from "@/core/api/api-error";
import { useTranslation } from "@/core/i18n/locale-store";
import { changeVaultPin } from "@/core/vault/vault-store";
import { PIN_LENGTH, PinPad } from "@/ui/pin-pad";
import { PinScreen } from "@/ui/pin-screen";
import { usePinEntry } from "@/ui/use-pin-entry";

type Step = "current" | "next" | "confirm";

/**
 * Three steps on one screen, because the old PIN is only provably correct once
 * the server has rewrapped the vault under the new one: there is no endpoint
 * that checks it alone. So a wrong current code surfaces at the very end, and
 * the whole sequence restarts rather than pretending the first step passed.
 */
export default function ChangePinScreen() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("current");
  const currentPin = useRef<string | null>(null);
  const nextPin = useRef<string | null>(null);

  function restart() {
    currentPin.current = null;
    nextPin.current = null;
    setStep("current");
  }

  const { pin, setPin, errorMessage, isBusy } = usePinEntry(
    async (candidate) => {
      if (step === "current") {
        currentPin.current = candidate;
        setStep("next");
        hapticCommit();
        return null;
      }

      if (step === "next") {
        if (candidate === currentPin.current) {
          return t("settings.security.changePinSame");
        }
        nextPin.current = candidate;
        setStep("confirm");
        hapticCommit();
        return null;
      }

      if (candidate !== nextPin.current) {
        setStep("next");
        nextPin.current = null;
        return t("vault.pinMismatch");
      }

      try {
        await changeVaultPin(currentPin.current ?? "", candidate);
        hapticSuccess();
        router.back();
        return null;
      } catch (error) {
        restart();
        return t(
          isApiError(error) &&
            error.code === API_ERROR_CODES.ENCRYPTION_KEY_CHECK_FAILED
            ? "settings.security.changePinWrongCurrent"
            : "settings.security.changePinError",
        );
      }
    },
  );

  return (
    <PinScreen
      title={t(`settings.security.changePinTitle.${step}`)}
      subtitle={
        step === "current"
          ? t("settings.security.changePinCurrentSubtitle")
          : t("vault.setup.subtitle", { count: PIN_LENGTH })
      }
      footer={
        <Button onPress={() => router.back()} disabled={isBusy}>
          {t("common.cancel")}
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
