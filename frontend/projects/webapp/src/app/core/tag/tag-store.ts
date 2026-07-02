import { Injectable, computed, inject } from '@angular/core';
import {
  type Tag,
  type TagCreate,
  type TagListResponse,
  type TagResponse,
} from 'pulpe-shared';
import { firstValueFrom, map } from 'rxjs';
import { cachedMutation, cachedResource } from 'ngx-ziflux';
import { TagApi } from '@core/tag/tag-api';
import { Logger } from '@core/logging/logger';

/**
 * Shared store for user-owned tags (PUL-18). Tags are cross-feature metadata
 * attached to transactions, so this store is a root singleton (unlike the
 * route-scoped feature stores) and is consumed by the reusable tag picker.
 */
@Injectable({ providedIn: 'root' })
export class TagStore {
  readonly #tagApi = inject(TagApi);
  readonly #logger = inject(Logger);

  readonly tags = cachedResource({
    cache: this.#tagApi.cache,
    cacheKey: ['tags', 'list'],
    loader: () =>
      this.#tagApi
        .getAll$()
        .pipe(map((response) => this.#extractTags(response))),
  });

  readonly tagNameById = computed(() => {
    const byId = new Map<string, string>();
    for (const tag of this.tags.value() ?? []) {
      byId.set(tag.id, tag.name);
    }
    return byId;
  });

  readonly #createTagMutation = cachedMutation<TagCreate, TagResponse, void>({
    cache: this.#tagApi.cache,
    mutationFn: (tag) => this.#tagApi.create$(tag),
    invalidateKeys: () => [['tags']],
    onSuccess: (response) => {
      this.tags.update((tags) => [...(tags ?? []), response.data]);
    },
  });

  /**
   * Loads tags on demand for non-reactive consumers (e.g. Excel export) that
   * read `tagNameById()` synchronously. No-op once a value is cached.
   */
  async ensureLoaded(): Promise<void> {
    if (this.tags.hasValue()) return;
    const response = await firstValueFrom(this.#tagApi.getAll$());
    this.tags.set(this.#extractTags(response));
  }

  /**
   * Creates a tag and returns it, or `undefined` when the mutation fails
   * (e.g. `ERR_TAG_ALREADY_EXISTS`). Callers surface the error to the user.
   */
  async addTag(name: string): Promise<Tag | undefined> {
    const result = await this.#createTagMutation.mutate({ name });
    if (result) return result.data;
    this.#logger.error('Tag creation failed', this.#createTagMutation.error());
    return undefined;
  }

  #extractTags(response: TagListResponse): Tag[] {
    return Array.isArray(response.data) ? response.data : [];
  }
}
