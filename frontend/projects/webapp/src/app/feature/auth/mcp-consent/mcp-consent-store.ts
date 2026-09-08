import { Service, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ANALYTICS_EVENTS, type McpAccessMode } from 'pulpe-shared';
import { AnalyticsService } from '@core/analytics/analytics';
import { McpApi } from '@core/mcp/mcp-api';
import { DERIVE_CLIENT_KEY, EncryptionApi } from '@core/encryption';

/**
 * State of one OAuth consent request. The vault code is turned into the
 * client key here and sent once, as an explicit header on the approval
 * call: it is never stored in `ClientKeyService`, so this page does not
 * unlock the app.
 */
@Service({ autoProvided: false })
export class McpConsentStore {
  readonly #api = inject(McpApi);
  readonly #encryptionApi = inject(EncryptionApi);
  readonly #deriveClientKey = inject(DERIVE_CLIENT_KEY);
  readonly #analytics = inject(AnalyticsService);

  readonly authorizationId = signal<string | null>(null);
  readonly clientName = signal<string | null>(null);
  readonly mode = signal<McpAccessMode>('read');

  async load(authorizationId: string): Promise<void> {
    this.authorizationId.set(authorizationId);
    const { clientName } = await firstValueFrom(
      this.#api.getConsent$(this.#requestId()),
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
    const mode = this.mode();
    const { redirectUrl } = await firstValueFrom(
      this.#api.approve$(this.#requestId(), mode, clientKeyHex),
    );
    // ponytail: declared client name; use verified client metadata if attribution needs proof.
    // Only fixed categories leave the app, never the name or OAuth credentials.
    const assistant =
      this.clientName()
        ?.match(/\b(chatgpt|claude)\b/i)?.[1]
        .toLowerCase() ?? 'other';
    this.#analytics.captureEvent(
      ANALYTICS_EVENTS.MCP_CONNECTION_AUTHORIZED,
      { assistant, access_mode: mode },
      { transport: 'sendBeacon', send_instantly: true },
    );
    return redirectUrl;
  }

  /** @returns the URL carrying `error=access_denied` for the client. */
  async deny(): Promise<string> {
    const { redirectUrl } = await firstValueFrom(
      this.#api.deny$(this.#requestId()),
    );
    return redirectUrl;
  }

  #requestId(): string {
    const id = this.authorizationId();
    if (!id) throw new Error('No authorization request loaded');
    return id;
  }
}
