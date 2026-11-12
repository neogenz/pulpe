import { firstValueFrom } from 'rxjs';
import type { AssetCategory } from 'pulpe-shared';
import type { AssetApi } from './asset-api';

/** An existing Type, or the name of one to reuse or create on save. */
export type CategoryChoice = { id: string } | { name: string };

/**
 * Returns the id of the chosen Type. A name is matched case-insensitively
 * against every Type the API returned, including the ones no element uses:
 * those are hidden on screen, never deleted, and reused by name.
 */
export async function resolveAssetCategory(
  api: Pick<AssetApi, 'createCategory$'>,
  categories: readonly AssetCategory[],
  choice: CategoryChoice,
): Promise<string> {
  if ('id' in choice) return choice.id;
  const name = choice.name.trim();
  const existing = categories.find(
    (category) => category.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) return existing.id;
  const created = await firstValueFrom(api.createCategory$({ name }));
  return created.data.id;
}
