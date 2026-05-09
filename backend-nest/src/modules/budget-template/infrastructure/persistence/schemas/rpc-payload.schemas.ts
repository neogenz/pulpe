import { z } from 'zod';
import {
  exchangeRateWirePositive,
  supportedCurrencySchema,
  transactionKindSchema,
  transactionRecurrenceSchema,
} from 'pulpe-shared';

// ----------------------------------------------------------------------------
// create_template_with_lines — p_lines JSONB item shape
//
// Matches SQL access `line->>'name' | 'amount' | 'kind' | 'recurrence' |
// 'description' | 'original_amount' | 'original_currency' | 'target_currency'
// | 'exchange_rate'` (see migration 20260427120000_create_template_with_lines_fx_columns).
// `amount` + `original_amount` are AES-256-GCM ciphertexts produced by
// EncryptionService. `exchange_rate` is a finite positive number or null.
// ----------------------------------------------------------------------------
export const createTemplateLineRpcPayloadSchema = z
  .object({
    name: z.string().min(1),
    amount: z.string().min(1),
    kind: transactionKindSchema,
    recurrence: transactionRecurrenceSchema,
    description: z.string(),
    original_amount: z.string().min(1).nullable(),
    original_currency: supportedCurrencySchema.nullable(),
    target_currency: supportedCurrencySchema.nullable(),
    exchange_rate: exchangeRateWirePositive.nullable(),
  })
  .strict();

export const createTemplateLinesRpcPayloadSchema = z.array(
  createTemplateLineRpcPayloadSchema,
);

export type CreateTemplateLineRpcPayload = z.infer<
  typeof createTemplateLineRpcPayloadSchema
>;

// ----------------------------------------------------------------------------
// apply_template_line_operations — updated_lines / created_lines JSONB shape
//
// Matches SQL access `line->>'id' | 'name' | 'amount' | 'kind' | 'recurrence'
// | 'original_amount' | 'original_currency' | 'target_currency' |
// 'exchange_rate'` (see migration 20260417120000_rpcs_copy_currency_columns).
// `amount` + `original_amount` are ciphertexts. `exchange_rate` is a finite
// positive number or null.
// ----------------------------------------------------------------------------
// Partial-patch shape — only `id` is mandatory. Missing keys mean
// "preserve existing" on the SQL side via the `jsonb ? 'key'` operator.
// Creates pass all fields (use case populates them); updates pass only
// the subset the user changed.
export const applyTemplateLineOperationsItemSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).optional(),
    amount: z.string().min(1).nullable().optional(),
    kind: transactionKindSchema.optional(),
    recurrence: transactionRecurrenceSchema.optional(),
    original_amount: z.string().min(1).nullable().optional(),
    original_currency: supportedCurrencySchema.nullable().optional(),
    target_currency: supportedCurrencySchema.nullable().optional(),
    exchange_rate: exchangeRateWirePositive.nullable().optional(),
    description: z.string().nullable().optional(),
  })
  .strict();

export const applyTemplateLineOperationsListSchema = z.array(
  applyTemplateLineOperationsItemSchema,
);

export type ApplyTemplateLineOperationsItem = z.infer<
  typeof applyTemplateLineOperationsItemSchema
>;
