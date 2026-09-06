import { Service, inject } from '@angular/core';
import { DataCache } from 'ngx-ziflux';
import { map } from 'rxjs';
import {
  type McpAccessMode,
  mcpActivityListResponseSchema,
  mcpActivityQuerySchema,
  mcpConnectionListResponseSchema,
  mcpConsentApproveRequestSchema,
  mcpConsentDetailsResponseSchema,
  mcpConsentRedirectResponseSchema,
} from 'pulpe-shared';
import { ApiClient } from '@core/api/api-client';

@Service()
export class McpApi {
  readonly #api = inject(ApiClient);
  // Only connection metadata is cached, never consent requests or vault keys.
  readonly cache = new DataCache({ name: 'mcp-connections' });

  clearCache(): void {
    this.cache.clear();
  }

  getConnections$() {
    return this.#api
      .get$('/mcp/connections', mcpConnectionListResponseSchema)
      .pipe(map((response) => response.data));
  }

  getActivity$(connectionId: string, limit: number) {
    const query = mcpActivityQuerySchema.parse({ limit });
    const search = new URLSearchParams({ limit: String(query.limit) });
    return this.#api
      .get$(
        `/mcp/connections/${encodeURIComponent(connectionId)}/activity?${search}`,
        mcpActivityListResponseSchema,
      )
      .pipe(map((response) => response.data));
  }

  revoke$(connectionId: string) {
    return this.#api.deleteVoid$(
      `/mcp/connections/${encodeURIComponent(connectionId)}`,
    );
  }

  getConsent$(authorizationId: string) {
    return this.#api.get$(
      this.#consentPath(authorizationId),
      mcpConsentDetailsResponseSchema,
    );
  }

  approve$(authorizationId: string, mode: McpAccessMode, clientKey: string) {
    return this.#api.post$(
      `${this.#consentPath(authorizationId)}/approve`,
      { mode },
      mcpConsentRedirectResponseSchema,
      mcpConsentApproveRequestSchema,
      { 'X-Client-Key': clientKey },
    );
  }

  deny$(authorizationId: string) {
    return this.#api.post$(
      `${this.#consentPath(authorizationId)}/deny`,
      {},
      mcpConsentRedirectResponseSchema,
    );
  }

  #consentPath(authorizationId: string): string {
    return `/mcp/consent/${encodeURIComponent(authorizationId)}`;
  }
}
