import { Injectable, inject } from '@angular/core';
import { type BudgetTemplate } from 'pulpe-shared';
import { firstValueFrom } from 'rxjs';
import { createListCache } from '@core/cache';
import { TemplateApi } from './template-api';
import { Logger } from '../logging/logger';

@Injectable({ providedIn: 'root' })
export class TemplateCache {
  readonly #templateApi = inject(TemplateApi);
  readonly #logger = inject(Logger);

  readonly #listCache = createListCache<BudgetTemplate>({
    fetcher: () => firstValueFrom(this.#templateApi.getAll$()),
    label: 'TemplateCache',
    onError: (error) =>
      this.#logger.error('[TemplateCache] Failed to preload templates', error),
  });

  readonly templates = this.#listCache.data;
  readonly isLoading = this.#listCache.isLoading;
  readonly hasTemplates = this.#listCache.hasData;

  preloadAll(): Promise<BudgetTemplate[]> {
    return this.#listCache.preload();
  }

  invalidate(): void {
    this.#listCache.invalidate();
  }

  clear(): void {
    this.#listCache.clear();
  }
}
