import { useCallback, useEffect, useRef, useState } from "react";

import { hapticFailure } from "@/core/ui/haptics";
import { translate } from "@/core/i18n/i18n";

import { PIN_LENGTH } from "./pin-pad";

const ERROR_DISPLAY_MS = 3000;

/**
 * Runs once the last digit lands. Returns the message to show, or null when
 * the step went through. Anything it throws is treated as a request failure
 * and described by the API error itself — a returned message is for the
 * checks that never leave the device, such as two PINs that disagree.
 */
type PinStepHandler = (pin: string) => Promise<string | null>;

interface PinEntry {
  pin: string;
  setPin: (next: string) => void;
  errorMessage: string | null;
  isBusy: boolean;
}

/**
 * The submit behaviour the three vault steps share: no validate button — the
 * fourth digit is the submit — the pad locked while the step runs, and an
 * error that clears itself so the user is never stuck looking at a stale one.
 */
export function usePinEntry(handle: PinStepHandler): PinEntry {
  const [pin, setPin] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const errorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A ref, so a handler rebuilt on every render does not re-trigger the step.
  // Refreshed from an effect declared before the one that reads it, so the
  // step always runs the handler from the render it was committed with.
  const handleRef = useRef(handle);
  const isRunning = useRef(false);

  useEffect(() => {
    handleRef.current = handle;
  });

  useEffect(
    () => () => {
      if (errorTimeout.current) clearTimeout(errorTimeout.current);
    },
    [],
  );

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    hapticFailure();

    if (errorTimeout.current) clearTimeout(errorTimeout.current);
    errorTimeout.current = setTimeout(
      () => setErrorMessage(null),
      ERROR_DISPLAY_MS,
    );
  }, []);

  useEffect(() => {
    if (pin.length < PIN_LENGTH || isRunning.current) return;

    isRunning.current = true;
    setIsBusy(true);

    void (async () => {
      let message: string | null;
      try {
        message = await handleRef.current(pin);
      } catch {
        message = translate("vault.error");
      }

      isRunning.current = false;
      setIsBusy(false);
      setPin("");
      if (message !== null) showError(message);
    })();
  }, [pin, showError]);

  const updatePin = useCallback((next: string) => {
    setPin(next);
    setErrorMessage(null);
  }, []);

  return { pin, setPin: updatePin, errorMessage, isBusy };
}
