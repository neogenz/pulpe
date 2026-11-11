import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { AssetCategory } from 'pulpe-shared';
import { resolveAssetCategory } from './asset-category';

const accounts = { id: 'cat-1', name: 'Comptes' } as AssetCategory;

function createApi() {
  return {
    createCategory$: vi.fn(() =>
      of({ success: true as const, data: { id: 'cat-new', name: 'Crypto' } }),
    ),
  };
}

describe('resolveAssetCategory', () => {
  it('returns the id of a Type picked by id', async () => {
    const api = createApi();

    const id = await resolveAssetCategory(api as never, [accounts], {
      id: 'cat-1',
    });

    expect(id).toBe('cat-1');
    expect(api.createCategory$).not.toHaveBeenCalled();
  });

  it('reuses an existing Type whose name matches, whatever the case', async () => {
    const api = createApi();

    const id = await resolveAssetCategory(api as never, [accounts], {
      name: ' comptes ',
    });

    expect(id).toBe('cat-1');
    expect(api.createCategory$).not.toHaveBeenCalled();
  });

  it('creates the Type once when the name is unknown', async () => {
    const api = createApi();

    const id = await resolveAssetCategory(api as never, [accounts], {
      name: 'Crypto',
    });

    expect(id).toBe('cat-new');
    expect(api.createCategory$).toHaveBeenCalledExactlyOnceWith({
      name: 'Crypto',
    });
  });
});
