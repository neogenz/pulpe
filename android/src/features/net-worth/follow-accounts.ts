import type { AssetSnapshotsCreate } from "pulpe-shared";

import { recordAssetSnapshots, updateAsset } from "./net-worth-api";

export interface FollowAccountsInput {
  links: string[];
  unlinks: string[];
  snapshots: AssetSnapshotsCreate["items"];
}

/**
 * What a comparison leaves in « Mon patrimoine », as one write: the accounts
 * now followed or no longer, then one batch of balances. It never creates an
 * account. `AssetStore.followAccounts` on iOS. The first refusal stops the rest.
 */
export async function followAccounts(
  input: FollowAccountsInput,
): Promise<void> {
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
