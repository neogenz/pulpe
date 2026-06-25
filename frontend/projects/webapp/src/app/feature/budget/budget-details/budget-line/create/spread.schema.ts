import { z } from 'zod/v4';
import {
  transactionKindSchema,
  type BudgetLineSpreadCreate,
} from 'pulpe-shared';
import { conversionFormSchema } from '@core/currency';

/**
 * Source of truth for the outgoing BudgetLineSpreadCreate DTO:
 * shared/schemas.ts (budgetLineSpreadCreateSchema).
 *
 * Interprétation B (PUL-17, PUL-287): the client sends an INTENT, not tranches.
 * It computes WHICH months are selected (`months`) and the per-month amount
 * (`perMonthAmount`, already converted to the target currency at submit). The
 * server replicates that per-month amount across every selected month into N
 * independent `one_off` budget lines before the RPC fan-out.
 *
 * Form value shape:
 * - `name`, `kind` (income excluded — revenu lissé hors scope V1)
 * - `perMonthAmount`: the converted per-month amount (target currency)
 * - `months`: the selected `{year, month}` periods
 * - `conversion`: the single frozen FX metadata (null when no conversion);
 *   `conversion.originalAmount` maps to the top-level `perMonthOriginalAmount`,
 *   which the server replicates per month.
 */

const spreadMonthSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
});

export const budgetLineSpreadCreateFromFormSchema = z
  .object({
    name: z.string().min(1).max(100).trim(),
    kind: transactionKindSchema.exclude(['income']),
    perMonthAmount: z.number().positive(),
    months: z.array(spreadMonthSchema).min(1),
    conversion: conversionFormSchema.nullable(),
  })
  .transform((input): BudgetLineSpreadCreate => {
    const conversion = input.conversion;

    return {
      name: input.name,
      kind: input.kind,
      perMonthAmount: input.perMonthAmount,
      months: input.months,
      ...(conversion
        ? {
            originalCurrency: conversion.originalCurrency,
            targetCurrency: conversion.targetCurrency,
            exchangeRate: conversion.exchangeRate,
            perMonthOriginalAmount: conversion.originalAmount,
          }
        : {}),
    };
  });

export type BudgetLineSpreadCreateFormValue = z.input<
  typeof budgetLineSpreadCreateFromFormSchema
>;
