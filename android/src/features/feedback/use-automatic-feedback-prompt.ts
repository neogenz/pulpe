import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { useSessionStore } from "@/core/auth/session-store";

import { fetchHasSubmittedFeedback } from "./feedback-api";
import {
  isFeedbackPromptEligible,
  markFeedbackPromptShown,
  markFeedbackSubmitted,
  recordActiveDay,
} from "./feedback-prompt";

/**
 * The automatic feedback invitation. Evaluated at two moments only — the home
 * finishing its first load, and the app coming back to the foreground — so a
 * sheet that closes does not immediately make room for this one. Returns the
 * number of the invitation to show, or `null`.
 *
 * Fails closed: while the server cannot say whether the account answered
 * (offline, error), nobody is invited.
 */
export function useAutomaticFeedbackPrompt({
  isReady,
  isBlocked,
}: {
  isReady: boolean;
  isBlocked: boolean;
}): { promptNumber: number | null; dismiss: () => void } {
  const userId = useSessionStore((state) => state.user?.id);
  const [promptNumber, setPromptNumber] = useState<number | null>(null);
  const gate = useRef({ isReady, isBlocked });

  useEffect(() => {
    gate.current = { isReady, isBlocked };
  });

  useEffect(() => {
    if (userId === undefined) return;
    let isCurrent = true;

    async function evaluate(): Promise<void> {
      recordActiveDay(userId!);
      if (!gate.current.isReady || !isFeedbackPromptEligible(userId!)) return;
      const hasSubmitted = await fetchHasSubmittedFeedback().catch(() => null);
      if (hasSubmitted === null) return;
      if (hasSubmitted) {
        markFeedbackSubmitted(userId!);
        return;
      }
      // The gate is read again: a sheet may have opened during the request.
      if (!isCurrent || gate.current.isBlocked) return;
      if (!isFeedbackPromptEligible(userId!)) return;
      setPromptNumber(markFeedbackPromptShown(userId!));
    }

    if (isReady) void evaluate();
    // A system dialog also passes through "inactive": only a real return from
    // the background counts.
    let wasInBackground = false;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") wasInBackground = true;
      if (state === "active" && wasInBackground) {
        wasInBackground = false;
        void evaluate();
      }
    });
    return () => {
      isCurrent = false;
      subscription.remove();
    };
    // Re-evaluated when the home becomes ready, never when `isBlocked` clears.
  }, [userId, isReady]);

  return { promptNumber, dismiss: () => setPromptNumber(null) };
}
