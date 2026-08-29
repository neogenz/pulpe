import { useRef, useState } from "react";

import { useTranslation } from "@/core/i18n/locale-store";
import { hapticCommit, hapticSuccess } from "@/core/ui/haptics";
import { setupVaultPin } from "@/core/vault/vault-store";

import { usePinEntry } from "./use-pin-entry";

interface PinCeremony extends ReturnType<typeof usePinEntry> {
  /** The first PIN is held and the user is typing it a second time. */
  isConfirming: boolean;
}

/**
 * The two-step PIN ceremony the vault setup screen and the onboarding PIN
 * step share: type a code, type it again, and only a match reaches the
 * server. A mismatch or a failed setup starts over from the first digit — a
 * failed setup leaves no key behind, so there is nothing to confirm.
 *
 * `onConfirmed` runs once `setupVaultPin` has succeeded; what happens next
 * (nothing, or the onboarding submission) is the screen's own business.
 */
export function usePinCeremony(onConfirmed: () => void): PinCeremony {
  const { t } = useTranslation();
  const [isConfirming, setIsConfirming] = useState(false);
  const firstPin = useRef<string | null>(null);

  function restart() {
    firstPin.current = null;
    setIsConfirming(false);
  }

  const entry = usePinEntry(async (candidate) => {
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
      restart();
      return t("vault.error");
    }

    hapticSuccess();
    onConfirmed();
    return null;
  });

  return { ...entry, isConfirming };
}
