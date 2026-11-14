import type {
  SupportedCurrency,
  Transaction,
  TransactionCreate,
  TransactionUpdate,
} from "pulpe-shared";

/** What an amount typed in the other currency becomes in the display currency. */
export interface MovementConversion {
  /** The figure booked, in the display currency, rounded to cents. */
  amount: number;
  originalAmount: number;
  originalCurrency: SupportedCurrency;
  targetCurrency: SupportedCurrency;
  /** Frozen as quoted: only the booked amount is rounded. */
  exchangeRate: number;
}

/** `null` while there is nothing to convert, or no rate to convert with. */
export function convertMovementAmount(
  amount: number | null,
  from: SupportedCurrency,
  to: SupportedCurrency,
  rate: number | undefined,
): MovementConversion | null {
  if (amount === null || amount <= 0 || from === to || rate === undefined) {
    return null;
  }
  return {
    amount: Math.round(amount * rate * 100) / 100,
    originalAmount: amount,
    originalCurrency: from,
    targetCurrency: to,
    exchangeRate: rate,
  };
}

/** The payload with the foreign leg the server stores beside the booked amount. */
export function withConversion(
  payload: TransactionCreate,
  conversion: MovementConversion | null,
): TransactionCreate {
  if (conversion === null) return payload;
  return {
    ...payload,
    amount: conversion.amount,
    originalAmount: conversion.originalAmount,
    originalCurrency: conversion.originalCurrency,
    targetCurrency: conversion.targetCurrency,
    exchangeRate: conversion.exchangeRate,
  };
}

/** The figure and currency a booked movement was typed in. */
export interface ForeignLeg {
  amount: number;
  currency: SupportedCurrency;
}

/**
 * Port of `EditTransactionLogic.shouldShowAlternateCurrency` / `initialAmount`:
 * a movement booked from another currency is edited in that currency, `null`
 * for one typed in the display currency.
 */
export function foreignLegOf(
  transaction: Transaction,
  displayCurrency: SupportedCurrency,
): ForeignLeg | null {
  const { originalAmount, originalCurrency } = transaction;
  if (
    originalAmount == null ||
    originalCurrency == null ||
    originalCurrency === displayCurrency
  ) {
    return null;
  }
  return { amount: originalAmount, currency: originalCurrency };
}

/** The booked amount and the foreign leg that moved with it, as one update. */
export function conversionUpdate(
  conversion: MovementConversion,
): Pick<
  TransactionUpdate,
  | "amount"
  | "originalAmount"
  | "originalCurrency"
  | "targetCurrency"
  | "exchangeRate"
> {
  return {
    amount: conversion.amount,
    originalAmount: conversion.originalAmount,
    originalCurrency: conversion.originalCurrency,
    targetCurrency: conversion.targetCurrency,
    exchangeRate: conversion.exchangeRate,
  };
}
