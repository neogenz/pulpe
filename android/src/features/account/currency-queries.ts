import { useQuery } from "@tanstack/react-query";
import {
  type CurrencyRateResponse,
  currencyRateResponseSchema,
  type SupportedCurrency,
} from "pulpe-shared";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

/** A day, in milliseconds: the rate carries the date it was quoted on. */
const RATE_STALE_MS = 86_400_000;

function fetchCurrencyRate(
  base: SupportedCurrency,
  target: SupportedCurrency,
): Promise<CurrencyRateResponse["data"]> {
  return api
    .get(ENDPOINTS.currencyRate, currencyRateResponseSchema, { base, target })
    .then((response) => response.data);
}

/**
 * The reference rate between the two supported currencies, shown so a currency
 * change is not a leap in the dark. Nothing in the app converts amounts with
 * it — it is information, not a calculation input.
 */
export function useCurrencyRate(
  base: SupportedCurrency,
  target: SupportedCurrency,
) {
  return useQuery({
    queryKey: ["currency-rate", base, target],
    queryFn: () => fetchCurrencyRate(base, target),
    enabled: base !== target,
    staleTime: RATE_STALE_MS,
  });
}
