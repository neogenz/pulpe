import {
  type Asset,
  FEATURE_FLAGS,
  type SupportedCurrency,
} from "pulpe-shared";

import { useFeatureFlag } from "@/core/observability/feature-flags";
import { useNetWorth } from "@/features/net-worth/net-worth-queries";

import { ownAccounts } from "./reconcile-account-links";

/**
 * My accounts of the user's currency, followed or not, for the reconciliation
 * being opened — `ReconcileLinkedAccountsGate` on iOS. `undefined` while they
 * load; `null` with the flag off or a failed read: rows are plain lines and
 * finishing writes nothing to « Mon patrimoine ».
 */
export function useReconcileLinkedAccounts(
  isOpen: boolean,
  currency: SupportedCurrency,
): Asset[] | null | undefined {
  const isEnabled = useFeatureFlag(FEATURE_FLAGS.NET_WORTH);
  const netWorth = useNetWorth(isEnabled && isOpen);

  if (!isEnabled) return null;
  if (netWorth.isFetching) return undefined;
  return netWorth.data === undefined
    ? null
    : ownAccounts(netWorth.data, currency);
}
