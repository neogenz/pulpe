import type {
  AssetCategory,
  AssetSnapshotsCreate,
  SupportedCurrency,
} from "pulpe-shared";

import { choiceForName } from "./asset-form-draft";
import {
  createAsset,
  createAssetCategory,
  recordAssetSnapshots,
  updateAsset,
} from "./net-worth-api";

export interface FollowAccountsInput {
  creates: { name: string; value: number }[];
  links: string[];
  unlinks: string[];
  snapshots: AssetSnapshotsCreate["items"];
  currency: SupportedCurrency;
  /** The Type a new account lands in, created when no Type carries the name. */
  categoryName: string;
}

/**
 * What a reconciliation leaves in « Mon patrimoine », as one write: the new
 * accounts, the ones now followed or no longer, then one batch of balances.
 * `AssetStore.followAccounts` on iOS. The first refusal stops the rest.
 */
export async function followAccounts(
  input: FollowAccountsInput,
  categories: AssetCategory[],
): Promise<void> {
  if (input.creates.length > 0) {
    // A Type no element uses is hidden, never deleted: its name reuses it.
    const match = choiceForName(input.categoryName, categories);
    const categoryId =
      match?.kind === "existing"
        ? match.id
        : (await createAssetCategory({ name: input.categoryName })).id;
    for (const { name, value } of input.creates) {
      await createAsset({
        name,
        categoryId,
        currency: input.currency,
        direction: "own",
        inPulpe: true,
        value,
      });
    }
  }
  for (const assetId of input.links) {
    await updateAsset({ assetId, changes: { inPulpe: true } });
  }
  for (const assetId of input.unlinks) {
    await updateAsset({ assetId, changes: { inPulpe: false } });
  }
  if (input.snapshots.length > 0) {
    await recordAssetSnapshots({ items: input.snapshots });
  }
}
