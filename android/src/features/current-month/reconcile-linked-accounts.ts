import {
  type Asset,
  type AssetCategory,
  FEATURE_FLAGS,
  type SupportedCurrency,
} from "pulpe-shared";

import { useFeatureFlag } from "@/core/observability/feature-flags";
import { useNetWorth } from "@/features/net-worth/net-worth-queries";

export interface LinkedAccounts {
  /** Active items in this currency, mine or owed, followed or not. */
  assets: Asset[];
  /** Their Types, in the order of Mon patrimoine. */
  categories: AssetCategory[];
}

/**
 * My accounts and what I owe, for the comparison being opened — `ReconcileLinkedAccountsGate` on iOS. `undefined`
 * while they load; `null` with the flag off or a failed read: every row is a
 * free one and finishing writes nothing to « Mon patrimoine ».
 */
export function useReconcileLinkedAccounts(
  isOpen: boolean,
  currency: SupportedCurrency,
): LinkedAccounts | null | undefined {
  const isEnabled = useFeatureFlag(FEATURE_FLAGS.NET_WORTH);
  const netWorth = useNetWorth(isEnabled && isOpen);

  if (!isEnabled) return null;
  if (netWorth.isFetching) return undefined;
  if (netWorth.data === undefined) return null;
  return {
    categories: netWorth.data.categories,
    assets: netWorth.data.assets.filter(
      (asset) => asset.archivedAt === null && asset.currency === currency,
    ),
  };
}
