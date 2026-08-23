import { Service, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom, map } from 'rxjs';
import {
  type McpActivity,
  type McpConnection,
  mcpActivityListResponseSchema,
  mcpConnectionListResponseSchema,
} from 'pulpe-shared';
import { ApiClient } from '@core/api/api-client';
import { Logger } from '@core/logging/logger';

/**
 * Agent connections of the signed-in user. One-shot data read by this page
 * alone, so a plain resource is enough: nothing else would share a cache.
 */
@Service({ autoProvided: false })
export class ConnectionsStore {
  readonly #api = inject(ApiClient);
  readonly #logger = inject(Logger);

  readonly #resource = rxResource({
    stream: () =>
      this.#api
        .get$('/mcp/connections', mcpConnectionListResponseSchema)
        .pipe(map((r) => r.data)),
  });

  readonly connections = computed<McpConnection[]>(
    () => this.#resource.value() ?? [],
  );
  readonly status = this.#resource.status;

  reload(): void {
    this.#resource.reload();
  }

  loadActivity(connectionId: string, limit: number): Promise<McpActivity[]> {
    return firstValueFrom(
      this.#api
        .get$(
          `/mcp/connections/${connectionId}/activity?limit=${limit}`,
          mcpActivityListResponseSchema,
        )
        .pipe(map((r) => r.data)),
    );
  }

  /** @returns `null` when the access is cut, otherwise the reason to surface. */
  async revoke(connectionId: string): Promise<string | null> {
    try {
      await firstValueFrom(
        this.#api.deleteVoid$(`/mcp/connections/${connectionId}`),
      );
      // The list is the source of truth for "still connected": drop the
      // card at once, no page reload.
      this.#resource.update((list) =>
        list?.filter((c) => c.id !== connectionId),
      );
      return null;
    } catch (error) {
      this.#logger.error('Agent connection revocation failed', error);
      return 'settings.connections.revokeError';
    }
  }
}
