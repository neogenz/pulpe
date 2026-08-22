import { onboardingTransactionSchema } from "pulpe-shared";
import { randomUUID } from "react-native-quick-crypto";
import { z } from "zod";

/** Exactly what `POST /budget-templates/from-onboarding` accepts per line. */
export type OnboardingTransactionWire = z.infer<
  typeof onboardingTransactionSchema
>;

/**
 * The wire shape plus a client-side identity. The id is what a suggestion chip
 * toggles on, what an edit replaces and what a list row keys off; it never
 * leaves the device, the same way `OnboardingTransaction.CodingKeys` drops it
 * on iOS.
 */
export const onboardingTransactionDraftSchema =
  onboardingTransactionSchema.extend({ id: z.string() });

export type OnboardingTransaction = z.infer<
  typeof onboardingTransactionDraftSchema
>;

export function createCustomTransaction(
  fields: Omit<OnboardingTransaction, "id">,
): OnboardingTransaction {
  return { id: randomUUID(), ...fields };
}

/** Drops the client-side id so the payload matches the schema the server parses. */
export function toWire(
  transaction: OnboardingTransaction,
): OnboardingTransactionWire {
  const { id: _id, ...wire } = transaction;
  return wire;
}
