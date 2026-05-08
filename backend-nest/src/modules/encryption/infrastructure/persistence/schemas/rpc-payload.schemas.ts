import { z } from 'zod';

// ----------------------------------------------------------------------------
// rekey_user_encrypted_data — JSONB payloads per table
//
// Matches the SQL `jsonb_to_recordset(...) AS item(id uuid, amount text, ...)`
// column lists in migrations 20260305120000_rekey_rpc_row_lock and
// 20260310120000_rekey_rpc_add_original_amount_columns.
//
// Critical: `jsonb_to_recordset` silently ignores unknown keys and maps missing
// ones to NULL. A typo like `ammount` would overwrite the encrypted column with
// NULL without raising. `.strict()` blocks this class of bug at the boundary.
// ----------------------------------------------------------------------------

const ciphertext = z.string().min(1);
const nullableCiphertext = ciphertext.nullable();
const uuid = z.string().uuid();

export const rekeyBudgetLineRpcPayloadSchema = z
  .object({
    id: uuid,
    amount: nullableCiphertext,
    original_amount: nullableCiphertext,
  })
  .strict();

export const rekeyBudgetLinesRpcPayloadSchema = z.array(
  rekeyBudgetLineRpcPayloadSchema,
);

export const rekeyTransactionRpcPayloadSchema = z
  .object({
    id: uuid,
    amount: nullableCiphertext,
    original_amount: nullableCiphertext,
  })
  .strict();

export const rekeyTransactionsRpcPayloadSchema = z.array(
  rekeyTransactionRpcPayloadSchema,
);

export const rekeyTemplateLineRpcPayloadSchema = z
  .object({
    id: uuid,
    amount: nullableCiphertext,
    original_amount: nullableCiphertext,
  })
  .strict();

export const rekeyTemplateLinesRpcPayloadSchema = z.array(
  rekeyTemplateLineRpcPayloadSchema,
);

export const rekeySavingsGoalRpcPayloadSchema = z
  .object({
    id: uuid,
    target_amount: nullableCiphertext,
    original_target_amount: nullableCiphertext,
  })
  .strict();

export const rekeySavingsGoalsRpcPayloadSchema = z.array(
  rekeySavingsGoalRpcPayloadSchema,
);

export const rekeyMonthlyBudgetRpcPayloadSchema = z
  .object({
    id: uuid,
    ending_balance: nullableCiphertext,
  })
  .strict();

export const rekeyMonthlyBudgetsRpcPayloadSchema = z.array(
  rekeyMonthlyBudgetRpcPayloadSchema,
);

export type RekeyBudgetLineRpcPayload = z.infer<
  typeof rekeyBudgetLineRpcPayloadSchema
>;
export type RekeyTransactionRpcPayload = z.infer<
  typeof rekeyTransactionRpcPayloadSchema
>;
export type RekeyTemplateLineRpcPayload = z.infer<
  typeof rekeyTemplateLineRpcPayloadSchema
>;
export type RekeySavingsGoalRpcPayload = z.infer<
  typeof rekeySavingsGoalRpcPayloadSchema
>;
export type RekeyMonthlyBudgetRpcPayload = z.infer<
  typeof rekeyMonthlyBudgetRpcPayloadSchema
>;
