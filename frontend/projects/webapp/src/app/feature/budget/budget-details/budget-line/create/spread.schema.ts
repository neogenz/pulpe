import { z } from 'zod/v4';
import {
  transactionKindSchema,
  spreadFromExistingPeriodSchema,
  type BudgetLineSpreadCreate,
} from 'pulpe-shared';
import { conversionFormSchema } from '@core/currency';

/**
 * Source of truth for the outgoing BudgetLineSpreadCreate DTO:
 * shared/schemas.ts (budgetLineSpreadCreateSchema).
 *
 * Interprétation B (PUL-17, PUL-287): the client sends an INTENT, not tranches.
 * It computes WHICH months are selected (`months`) and a single `amount`, then
 * picks one of two modes:
 *
 * - `total` (DEFAULT): `amount` is the TOTAL to spread. The SERVER divides it
 *   across the selected months with `splitTotalPreserving` (the client divides
 *   only for the live preview). Maps to `totalAmount`.
 * - `perMonth`: `amount` is the amount carried by EACH month, replicated as-is
 *   by the server. Maps to `perMonthAmount`.
 *
 * Form value shape:
 * - `name`, `kind` (income excluded — revenu lissé hors scope V1)
 * - `mode`: `'total' | 'perMonth'` discriminant
 * - `amount`: the converted amount (target currency) — total or per-month
 * - `months`: the selected `{year, month}` periods
 * - `conversion`: the single frozen FX metadata (null when no conversion);
 *   `conversion.originalAmount` maps to the mode-correct original-amount field
 *   (`totalOriginalAmount` in total mode, `perMonthOriginalAmount` otherwise).
 */

export const budgetLineSpreadCreateFromFormSchema = z
  .object({
    name: z.string().min(1).max(100).trim(),
    kind: transactionKindSchema.exclude(['income']),
    mode: z.enum(['total', 'perMonth']),
    amount: z.number().positive(),
    months: z.array(spreadFromExistingPeriodSchema).min(1),
    conversion: conversionFormSchema.nullable(),
  })
  .transform((input): BudgetLineSpreadCreate => {
    const conversion = input.conversion;
    const fxFields = conversion
      ? {
          originalCurrency: conversion.originalCurrency,
          targetCurrency: conversion.targetCurrency,
          exchangeRate: conversion.exchangeRate,
        }
      : {};

    if (input.mode === 'total') {
      return {
        name: input.name,
        kind: input.kind,
        mode: 'total',
        totalAmount: input.amount,
        months: input.months,
        ...fxFields,
        ...(conversion
          ? { totalOriginalAmount: conversion.originalAmount }
          : {}),
      };
    }

    return {
      name: input.name,
      kind: input.kind,
      mode: 'perMonth',
      perMonthAmount: input.amount,
      months: input.months,
      ...fxFields,
      ...(conversion
        ? { perMonthOriginalAmount: conversion.originalAmount }
        : {}),
    };
  });

export type BudgetLineSpreadCreateFormValue = z.input<
  typeof budgetLineSpreadCreateFromFormSchema
>;
