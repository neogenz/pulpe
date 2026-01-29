import { Injectable, computed, inject, signal } from '@angular/core';
import { type BudgetTemplate } from 'pulpe-shared';
import { firstValueFrom } from 'rxjs';
import { TemplateApi } from './template-api';
import { Logger } from '../logging/logger';

@Injectable({ providedIn: 'root' })
export class TemplateCache {
  readonly #templateApi = inject(TemplateApi);
  readonly #logger = inject(Logger);

  readonly #templates = signal<BudgetTemplate[] | null>(null);
  readonly #isLoading = signal(false);

  readonly templates = this.#templates.asReadonly();
  readonly isLoading = this.#isLoading.asReadonly();
  readonly hasTemplates = computed(() => this.#templates() !== null);

  async preloadAll(): Promise<BudgetTemplate[]> {
    const cached = this.#templates();
    if (cached !== null) return cached;
    if (this.#isLoading()) return [];

    this.#isLoading.set(true);
    try {
      const templates = await firstValueFrom(this.#templateApi.getAll$());
      this.#templates.set(templates);
      return templates;
    } catch (error) {
      this.#logger.error('[TemplateCache] Failed to preload templates', error);
      return [];
    } finally {
      this.#isLoading.set(false);
    }
  }

  invalidate(): void {
    this.#templates.set(null);
  }

  clear(): void {
    this.#templates.set(null);
    this.#isLoading.set(false);
  }
}
