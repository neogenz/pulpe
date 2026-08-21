import type { SupportedCurrency } from "pulpe-shared";
import { create } from "zustand";

import { translate } from "@/core/i18n/i18n";
import { useLocaleStore } from "@/core/i18n/locale-store";
import { updateUserSettings } from "@/core/user-settings/user-settings-api";

import {
  createTemplateFromOnboarding,
  deleteTemplate,
  generateInitialBudgets,
} from "./api";
import { captureFirstBudgetCreated } from "./onboarding-analytics";
import { completeOnboarding, useOnboardingStore } from "./onboarding-store";
import { toTemplatePayload } from "./template-payload";

/**
 * Turning the answers into an account is a single user-visible act, so it gets
 * one status rather than one per request: whichever call fails, what the user
 * is told is that the budget could not be created, and the retry starts the
 * whole sequence again.
 */
export type SubmissionStatus = "idle" | "submitting" | "failed";

interface SubmissionState {
  status: SubmissionStatus;
}

export const useSubmissionStore = create<SubmissionState>(() => ({
  status: "idle",
}));

/**
 * Runs only after the PIN ceremony: `X-Client-Key` is derived from the code,
 * and every one of these endpoints writes an encrypted amount, so calling them
 * earlier fails with `AUTH_CLIENT_KEY_MISSING`.
 */
export async function submitOnboarding(): Promise<void> {
  useSubmissionStore.setState({ status: "submitting" });

  const state = useOnboardingStore.getState();
  let templateId: string | null = null;

  try {
    templateId = await createTemplateFromOnboarding(
      toTemplatePayload(state, {
        name: translate("onboarding.template.name"),
        description: translate("onboarding.template.description", {
          name: state.firstName.trim(),
        }),
        locale: useLocaleStore.getState().locale,
      }),
    );
    await generateInitialBudgets(templateId, new Date());
  } catch {
    // A template with no budgets is not something the user can see or delete,
    // and leaving it behind would make the retry create a second one.
    if (templateId !== null) await discardTemplate(templateId);
    useSubmissionStore.setState({ status: "failed" });
    return;
  }

  // The budget exists either way, so the currency is not worth failing over —
  // it is one tap to change in the settings, where creating a second budget is
  // not.
  await persistCurrency(state.currency);

  // Before `completeOnboarding`, which spreads the initial state back over the
  // answers this event counts.
  captureFirstBudgetCreated(state);
  completeOnboarding();
  useSubmissionStore.setState({ status: "idle" });
}

export function dismissSubmissionError(): void {
  useSubmissionStore.setState({ status: "idle" });
}

async function discardTemplate(templateId: string): Promise<void> {
  try {
    await deleteTemplate(templateId);
  } catch {
    // Nothing useful to do: the generate call already failed, and the user is
    // about to be told so.
  }
}

async function persistCurrency(currency: SupportedCurrency): Promise<void> {
  try {
    await updateUserSettings({ currency });
  } catch {
    // Deliberately silent — see the call site.
  }
}
