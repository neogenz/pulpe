import { z } from 'zod';
import {
  supportedCurrencySchema,
  transactionKindSchema,
  transactionRecurrenceSchema,
} from 'pulpe-shared';

// ----------------------------------------------------------------------------
// create_template_with_lines — p_lines JSONB item shape
//
// Matches SQL access `line->>'name' | 'amount' | 'kind' | 'recurrence' |
// 'description'` (see migrations 20260129200002_update_rpc_functions_encryption
// and 20260214120000_update_rpc_functions_single_column). `amount` is an
// AES-256-GCM ciphertext produced by EncryptionService.prepareAmountsData.
// ----------------------------------------------------------------------------
export const createTemplateLineRpcPayloadSchema = z
  .object({
    name: z.string().min(1),
    amount: z.string().min(1),
    kind: transactionKindSchema,
    recurrence: transactionRecurrenceSchema,
    description: z.string(),
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
export const applyTemplateLineOperationsItemSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
    amount: z.string().min(1).nullable(),
    kind: transactionKindSchema,
    recurrence: transactionRecurrenceSchema,
    original_amount: z.string().min(1).nullable(),
    original_currency: supportedCurrencySchema.nullable(),
    target_currency: supportedCurrencySchema.nullable(),
    exchange_rate: z.number().finite().positive().nullable(),
  })
  .strict();

export const applyTemplateLineOperationsListSchema = z.array(
  applyTemplateLineOperationsItemSchema,
);

export type ApplyTemplateLineOperationsItem = z.infer<
  typeof applyTemplateLineOperationsItemSchema
>;
