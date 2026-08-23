import { supportedCurrencySchema } from "pulpe-shared";
import { createMMKV } from "react-native-mmkv";
import { z } from "zod";

import { ONBOARDING_STEPS } from "./onboarding-step";
import { onboardingTransactionDraftSchema } from "./onboarding-transaction";

/**
 * The onboarding draft is stored in plaintext, mirroring the `UserDefaults`
 * blob on iOS and for the same reason: the user has no PIN yet, so there is no
 * key to encrypt it with. The window is bounded — the draft is cleared on
 * completion, on abandon and on a social signup. What sits in it meanwhile is
 * self-reported estimates, readable only with physical access to an unlocked
 * device.
 */
const DRAFT_KEY = "pulpe-onboarding-data";

/**
 * Outlives the draft on purpose: it is what sends a user who signed out back to
 * the sign-in screen instead of through the welcome pitch a second time.
 */
const COMPLETED_KEY = "pulpe-onboarding-completed";

/**
 * The handoff is a one-time greeting, so it needs its own memory: reusing the
 * completion flag would show it again to anyone who reinstalls and re-onboards
 * — and never to someone whose first run predates it.
 */
const HANDOFF_SEEN_KEY = "pulpe-post-onboarding-seen";

const storage = createMMKV({ id: "pulpe-onboarding" });

/**
 * Every field is optional so a draft written by an earlier build still loads.
 * `email` is deliberately absent: it only means something inside the
 * registration form, and persisting it would outlive the account it created.
 */
const draftSchema = z.object({
  currentStep: z.enum(ONBOARDING_STEPS).optional(),
  firstName: z.string().optional(),
  currency: supportedCurrencySchema.optional(),
  monthlyIncome: z.number().nullable().optional(),
  housingCosts: z.number().nullable().optional(),
  healthInsurance: z.number().nullable().optional(),
  phonePlan: z.number().nullable().optional(),
  transportCosts: z.number().nullable().optional(),
  leasingCredit: z.number().nullable().optional(),
  customTransactions: z.array(onboardingTransactionDraftSchema).optional(),
  isSocialAuth: z.boolean().optional(),
  socialProvidedName: z.boolean().optional(),
  wasEmailRegistered: z.boolean().optional(),
  hasCompletedPinSetup: z.boolean().optional(),
});

export type OnboardingDraft = z.infer<typeof draftSchema>;

/**
 * Returns null when there is nothing to resume. A blob that no longer parses is
 * discarded rather than repaired: it would otherwise fail again on every
 * launch, and a half-restored draft is worse than a fresh start.
 */
export function readDraft(): OnboardingDraft | null {
  const stored = storage.getString(DRAFT_KEY);
  if (stored === undefined) return null;

  const parsed = draftSchema.safeParse(safeJsonParse(stored));
  if (!parsed.success) {
    clearDraft();
    return null;
  }
  return parsed.data;
}

export function writeDraft(draft: OnboardingDraft): void {
  storage.set(DRAFT_KEY, JSON.stringify(draft));
}

export function clearDraft(): void {
  storage.remove(DRAFT_KEY);
}

export function readOnboardingCompleted(): boolean {
  return storage.getBoolean(COMPLETED_KEY) === true;
}

export function writeOnboardingCompleted(): void {
  storage.set(COMPLETED_KEY, true);
}

export function readHandoffSeen(): boolean {
  return storage.getBoolean(HANDOFF_SEEN_KEY) === true;
}

export function writeHandoffSeen(): void {
  storage.set(HANDOFF_SEEN_KEY, true);
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
