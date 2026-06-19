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
 * Interprétation B (PUL-17): the spread is fanned out client-side into one
 * tranche per SELECTED month, all sharing a single frozen `exchangeRate`. Each
 * tranche carries the SAME per-month amount (`perMonthAmount`, already
 * converted to the target currency at submit) — the server inserts them as N
 * independent `one_off` budget lines.
 *
 * Form value shape:
 * - `name`, `kind` (income excluded — revenu lissé hors scope V1)
 * - `perMonthAmount`: the converted per-month amount (target currency)
 * - `months`: the selected `{year, month}` periods
 * - `conversion`: the single frozen FX metadata (null when no conversion);
 *   `conversion.originalAmount` is the per-month amount in the original currency
 *   and is replicated onto every tranche as `originalAmount`.
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
    const tranches = input.months.map((period) => ({
      year: period.year,
      month: period.month,
      amount: input.perMonthAmount,
      ...(conversion ? { originalAmount: conversion.originalAmount } : {}),
    }));

    return {
      name: input.name,
      kind: input.kind,
      tranches,
      ...(conversion
        ? {
            originalCurrency: conversion.originalCurrency,
            targetCurrency: conversion.targetCurrency,
            exchangeRate: conversion.exchangeRate,
          }
        : {}),
    };
  });

export type BudgetLineSpreadCreateFormValue = z.input<
  typeof budgetLineSpreadCreateFromFormSchema
>;
