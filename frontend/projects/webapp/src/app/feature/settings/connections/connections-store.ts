import { Service, computed, inject } from '@angular/core';
import { cachedResource } from 'ngx-ziflux';
import { firstValueFrom } from 'rxjs';
import { type McpActivity, type McpConnection } from 'pulpe-shared';
import { McpApi } from '@core/mcp/mcp-api';
import { Logger } from '@core/logging/logger';

/** Agent connections of the signed-in user. */
@Service({ autoProvided: false })
export class ConnectionsStore {
  readonly #api = inject(McpApi);
  readonly #logger = inject(Logger);

  readonly #resource = cachedResource({
    cache: this.#api.cache,
    cacheKey: ['connections'],
    loader: () => this.#api.getConnections$(),
  });

  readonly connections = computed<McpConnection[]>(
    () => this.#resource.value() ?? [],
  );
  readonly status = this.#resource.status;

  reload(): void {
    this.#resource.reload();
  }

  loadActivity(connectionId: string, limit: number): Promise<McpActivity[]> {
    return firstValueFrom(this.#api.getActivity$(connectionId, limit));
  }

  /** @returns `null` when the access is cut, otherwise the reason to surface. */
  async revoke(connectionId: string): Promise<string | null> {
    try {
      await firstValueFrom(this.#api.revoke$(connectionId));
      // The list is the source of truth for "still connected": drop the
      // card at once, no page reload.
      this.#resource.update((list) =>
        (list ?? []).filter((c) => c.id !== connectionId),
      );
      return null;
    } catch (error) {
      this.#logger.error('Agent connection revocation failed', error);
      return 'settings.connections.revokeError';
    }
  }
}
