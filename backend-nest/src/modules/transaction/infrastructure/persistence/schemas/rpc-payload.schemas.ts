import { z } from 'zod';
import {
  exchangeRateWirePositive,
  supportedCurrencySchema,
} from 'pulpe-shared';

// ----------------------------------------------------------------------------
// create_savings_goal_withdrawal / update_savings_goal_withdrawal (PUL-329)
//
// The `p_transaction` / `p_patch` JSONB is fed to `jsonb_populate_record` against
// `public.transaction`, so the keys are the COLUMN names, not the camelCase API
// ones. `amount` and `original_amount` are AES-256-GCM ciphertexts produced via
// ENCRYPTION_PORT and stored verbatim — no SQL-side crypto.
//
// `.strict()` is what stands between a typo and a silently NULLed encrypted
// column: `jsonb_populate_record` ignores unknown keys without a word, so
// `amount_` would write a NULL amount and the RPC would happily commit it
// (supabase.md RPC rule / ADR-0007).
// ----------------------------------------------------------------------------

/**
 * Champs que la RPC de création accepte. Ni `source_savings_goal_id` ni
 * `source_savings_goal_name` : la RPC les pose elle-même depuis `p_goal_id` et
 * le nom relu sous le verrou. Les laisser passer par le payload laisserait un
 * appelant figer un nom déjà périmé, ou pire, réclamer un autre objectif que
 * celui dont il a fait vérifier le solde.
 *
 * `budget_line_id` en revanche traverse (PUL-329 v2) : réaliser un retrait
 * ANNONCÉ, c'est allouer le réel à sa prévision. Sans lui, la sortie est
 * comptée deux fois — une fois dans le stock confirmé, une fois dans un
 * reliquat annoncé que plus rien ne vient éteindre.
 */
export const createSavingsGoalWithdrawalPayloadSchema = z
  .object({
    id: z.uuid().optional(),
    budget_id: z.uuid(),
    budget_line_id: z.uuid().nullable(),
    name: z.string().min(1),
    amount: z.string().min(1),
    original_amount: z.string().min(1).nullable(),
    original_currency: supportedCurrencySchema.nullable(),
    target_currency: supportedCurrencySchema.nullable(),
    exchange_rate: exchangeRateWirePositive.nullable(),
    kind: z.literal('income'),
    transaction_date: z.iso.datetime({ offset: true }),
    checked_at: z.iso.datetime({ offset: true }).nullable(),
  })
  .strict();

export type CreateSavingsGoalWithdrawalPayload = z.infer<
  typeof createSavingsGoalWithdrawalPayloadSchema
>;

/**
 * Patch partiel : `jsonb_populate_record` part de la ligne existante, donc une
 * clé absente laisse la valeur en place. `budget_line_id` reste hors du patch :
 * l'allocation se décide à la création et ne se déplace plus, et la RPC
 * n'écrit pas cette colonne — l'y glisser ferait croire à un déplacement qui
 * n'aurait pas lieu.
 */
export const updateSavingsGoalWithdrawalPayloadSchema = z
  .object({
    budget_id: z.uuid().optional(),
    name: z.string().min(1).optional(),
    amount: z.string().min(1).optional(),
    original_amount: z.string().min(1).nullable().optional(),
    original_currency: supportedCurrencySchema.nullable().optional(),
    target_currency: supportedCurrencySchema.nullable().optional(),
    exchange_rate: exchangeRateWirePositive.nullable().optional(),
    transaction_date: z.iso.datetime({ offset: true }).optional(),
    checked_at: z.iso.datetime({ offset: true }).nullable().optional(),
  })
  .strict();

export type UpdateSavingsGoalWithdrawalPayload = z.infer<
  typeof updateSavingsGoalWithdrawalPayloadSchema
>;
