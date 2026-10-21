import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler } from "react-native";

import { useTranslation } from "@/core/i18n/locale-store";
import { hapticCommit, hapticSuccess } from "@/core/ui/haptics";
import { setupVaultPin } from "@/core/vault/vault-store";

import { describePinFailure, usePinEntry } from "./use-pin-entry";

interface PinCeremony extends ReturnType<typeof usePinEntry> {
  /** The first PIN is held and the user is typing it a second time. */
  isConfirming: boolean;
  restart: () => void;
}

/**
 * The two-step PIN ceremony the vault setup screen and the onboarding PIN
 * step share: type a code, type it again, and only a match reaches the
 * server. A mismatch only clears the confirmation; a failed setup starts
 * over because there is no key to confirm.
 *
 * `onConfirmed` runs once `setupVaultPin` has succeeded; what happens next
 * (nothing, or the onboarding submission) is the screen's own business.
 */
export function usePinCeremony(onConfirmed: () => void): PinCeremony {
  const { t } = useTranslation();
  const [isConfirming, setIsConfirming] = useState(false);
  const firstPin = useRef<string | null>(null);

  function forgetFirstPin() {
    firstPin.current = null;
    setIsConfirming(false);
  }

  const entry = usePinEntry(
    async (candidate) => {
      if (firstPin.current === null) {
        firstPin.current = candidate;
        setIsConfirming(true);
        hapticCommit();
        return null;
      }

      if (candidate !== firstPin.current) {
        return t("vault.setup.mismatch");
      }

      try {
        await setupVaultPin(candidate);
      } catch (error) {
        forgetFirstPin();
        return describePinFailure(error);
      }

      firstPin.current = null;
      hapticSuccess();
      onConfirmed();
      return null;
    },
    { persistError: true },
  );

  const resetEntry = entry.setPin;
  const restart = useCallback(() => {
    firstPin.current = null;
    setIsConfirming(false);
    resetEntry("");
  }, [resetEntry]);

  useEffect(() => {
    if (!isConfirming && !entry.isBusy) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!entry.isBusy) restart();
        return true;
      },
    );
    return () => subscription.remove();
  }, [isConfirming, entry.isBusy, restart]);

  return { ...entry, isConfirming, restart };
}
