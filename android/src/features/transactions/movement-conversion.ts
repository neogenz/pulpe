import type { SupportedCurrency, TransactionCreate } from "pulpe-shared";

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
