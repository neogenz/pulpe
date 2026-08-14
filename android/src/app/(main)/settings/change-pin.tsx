import { router } from "expo-router";
import { useRef, useState } from "react";
import { Button } from "react-native-paper";

import { hapticCommit, hapticSuccess } from "@/core/ui/haptics";
import { normalizeApiError } from "@/core/api/api-error";
import { changeVaultPin } from "@/core/vault/vault-store";
import { PIN_LENGTH, PinPad } from "@/ui/pin-pad";
import { PinScreen } from "@/ui/pin-screen";
import { usePinEntry } from "@/ui/use-pin-entry";

type Step = "current" | "next" | "confirm";

const TITLES: Record<Step, string> = {
  current: "Ton code actuel",
  next: "Choisis ton nouveau code",
  confirm: "Confirme ton nouveau code",
};

/**
 * Three steps on one screen, because the old PIN is only provably correct once
 * the server has rewrapped the vault under the new one: there is no endpoint
 * that checks it alone. So a wrong current code surfaces at the very end, and
 * the whole sequence restarts rather than pretending the first step passed.
 */
export default function ChangePinScreen() {
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
          return "Choisis un code différent de l'actuel";
        }
        nextPin.current = candidate;
        setStep("confirm");
        hapticCommit();
        return null;
      }

      if (candidate !== nextPin.current) {
        setStep("next");
        nextPin.current = null;
        return "Les codes ne correspondent pas";
      }

      try {
        await changeVaultPin(currentPin.current ?? "", candidate);
        hapticSuccess();
        router.back();
        return null;
      } catch (error) {
        restart();
        return normalizeApiError(error).message;
      }
    },
  );

  return (
    <PinScreen
      title={TITLES[step]}
      subtitle={
        step === "current"
          ? "Saisis-le pour prouver que c'est bien toi. Une nouvelle clé de récupération remplacera la tienne."
          : `${PIN_LENGTH} chiffres — tes montants seront chiffrés avec ce code`
      }
      footer={
        <Button onPress={() => router.back()} disabled={isBusy}>
          Annuler
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
