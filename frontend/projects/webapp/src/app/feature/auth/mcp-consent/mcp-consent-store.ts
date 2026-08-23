import { Service, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  type McpAccessMode,
  mcpConsentApproveRequestSchema,
  mcpConsentDetailsResponseSchema,
  mcpConsentRedirectResponseSchema,
} from 'pulpe-shared';
import { ApiClient } from '@core/api/api-client';
import { DERIVE_CLIENT_KEY, EncryptionApi } from '@core/encryption';

/**
 * State of one OAuth consent request. The vault code is turned into the
 * client key here and sent once, as an explicit header on the approval
 * call: it is never stored in `ClientKeyService`, so this page does not
 * unlock the app.
 */
@Service({ autoProvided: false })
export class McpConsentStore {
  readonly #api = inject(ApiClient);
  readonly #encryptionApi = inject(EncryptionApi);
  readonly #deriveClientKey = inject(DERIVE_CLIENT_KEY);

  readonly authorizationId = signal<string | null>(null);
  readonly clientName = signal<string | null>(null);
  readonly mode = signal<McpAccessMode>('read_write');

  async load(authorizationId: string): Promise<void> {
    this.authorizationId.set(authorizationId);
    const { clientName } = await firstValueFrom(
      this.#api.get$(this.#path(), mcpConsentDetailsResponseSchema),
    );
    this.clientName.set(clientName);
  }

  /** @returns the URL the client expects the browser back on (carries the code). */
  async approve(vaultCode: string): Promise<string> {
    const { salt, kdfIterations } = await firstValueFrom(
      this.#encryptionApi.getSalt$(),
    );
    const clientKeyHex = await this.#deriveClientKey(
      vaultCode,
      salt,
      kdfIterations,
    );
    const { redirectUrl } = await firstValueFrom(
      this.#api.post$(
        `${this.#path()}/approve`,
        { mode: this.mode() },
        mcpConsentRedirectResponseSchema,
        mcpConsentApproveRequestSchema,
        { 'X-Client-Key': clientKeyHex },
      ),
    );
    return redirectUrl;
  }

  /** @returns the URL carrying `error=access_denied` for the client. */
  async deny(): Promise<string> {
    const { redirectUrl } = await firstValueFrom(
      this.#api.post$(
        `${this.#path()}/deny`,
        {},
        mcpConsentRedirectResponseSchema,
      ),
    );
    return redirectUrl;
  }

  #path(): string {
    const id = this.authorizationId();
    if (!id) throw new Error('No authorization request loaded');
    return `/mcp/consent/${encodeURIComponent(id)}`;
  }
}
