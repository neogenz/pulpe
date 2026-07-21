import { inject, Injectable } from '@angular/core';
import { type Observable } from 'rxjs';
import {
  type TagCreate,
  type TagHistoryQuery,
  type TagHistoryResponse,
  type TagListResponse,
  type TagResponse,
  tagCreateSchema,
  tagHistoryResponseSchema,
  tagListResponseSchema,
  tagResponseSchema,
} from 'pulpe-shared';
import { ApiClient } from '@core/api/api-client';
import { DataCache } from 'ngx-ziflux';

@Injectable({
  providedIn: 'root',
})
export class TagApi {
  readonly #api = inject(ApiClient);
  readonly cache = new DataCache({
    name: 'tags',
    staleTime: 60_000,
    expireTime: 600_000,
  });

  clearCache(): void {
    this.cache.clear();
  }

  getAll$(): Observable<TagListResponse> {
    return this.#api.get$('/tags', tagListResponseSchema);
  }

  getHistory$(
    tagId: string,
    query: TagHistoryQuery,
  ): Observable<TagHistoryResponse> {
    const search = new URLSearchParams({
      months: String(query.months),
      endMonth: String(query.endMonth),
      endYear: String(query.endYear),
    });
    return this.#api.get$(
      `/tags/${encodeURIComponent(tagId)}/history?${search.toString()}`,
      tagHistoryResponseSchema,
    );
  }

  create$(tag: TagCreate): Observable<TagResponse> {
    return this.#api.post$('/tags', tag, tagResponseSchema, tagCreateSchema);
  }
}
