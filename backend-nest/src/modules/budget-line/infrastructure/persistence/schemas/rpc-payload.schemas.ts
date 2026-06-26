import { z } from 'zod';
import {
  exchangeRateWirePositive,
  supportedCurrencySchema,
  transactionKindSchema,
  transactionRecurrenceSchema,
} from 'pulpe-shared';

// ----------------------------------------------------------------------------
// create_budget_lines_spread — p_lines JSONB item shape (PUL-17 fan-out).
//
// One item = one tranche → one budget_line row. `amount` / `original_amount`
// are AES-256-GCM ciphertexts produced via ENCRYPTION_PORT (stored as-is by the
// RPC — no SQL-side crypto). Matches the `jsonb_to_recordset(p_lines)` column
// list in migration 20260619130000_create_budget_lines_spread_rpc.
//
// `.strict()` rejects extra keys so a typo can't silently NULL an encrypted
// column (ADR-0007). `spread_group_id` is the shared RPC scalar param, NOT a
// per-item field.
// ----------------------------------------------------------------------------
export const createBudgetLineSpreadItemSchema = z
  .object({
    budget_id: z.string().uuid(),
    name: z.string().min(1),
    amount: z.string().min(1),
    kind: transactionKindSchema,
    recurrence: transactionRecurrenceSchema,
    savings_goal_id: z.string().uuid().nullable(),
    original_amount: z.string().min(1).nullable(),
    original_currency: supportedCurrencySchema.nullable(),
    target_currency: supportedCurrencySchema.nullable(),
    exchange_rate: exchangeRateWirePositive.nullable(),
  })
  .strict();

export const createBudgetLineSpreadListSchema = z.array(
  createBudgetLineSpreadItemSchema,
);

export type CreateBudgetLineSpreadItem = z.infer<
  typeof createBudgetLineSpreadItemSchema
>;

// Exact message the spread RPC RAISEs (P0001) when the source row was already
// consumed by a concurrent request. Mirrored verbatim by migration
// consume_spread_source_before_insert and pinned by its SQL test; the repository
// matches on it to map the conflict to a 409 (BUDGET_LINE_ALREADY_SPREAD). Named
// here, next to the RPC contract, so the SQL↔TS coupling is greppable from one place.
export const SPREAD_SOURCE_UNAVAILABLE_RPC_MESSAGE =
  'Spread source unavailable';
