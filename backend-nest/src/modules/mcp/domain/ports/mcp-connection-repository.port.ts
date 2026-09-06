import type { Buffer } from 'node:buffer';
import type { AccessMode } from '../access-mode';

export const MCP_CONNECTION_REPOSITORY = Symbol('MCP_CONNECTION_REPOSITORY');

/** An active grant between one user and one OAuth client. Key `(userId, clientId)`. */
export interface ActiveMcpConnection {
  readonly id: string;
  readonly clientId: string;
  readonly mode: AccessMode;
  /** 32-byte vault key, already unwrapped. Zeroed by the caller after the request. */
  readonly clientKey: Buffer;
}

/** What the Connections screen shows: never the key. */
export interface McpConnectionSummary {
  readonly id: string;
  readonly clientName: string;
  readonly mode: AccessMode;
  readonly authorizedAt: string;
}

export interface McpConnectionRepositoryPort {
  /** `null` when the pair has no connection or it was revoked: the caller answers 401. */
  findActive(
    userId: string,
    clientId: string,
    generation: string,
  ): Promise<ActiveMcpConnection | null>;
  listActive(userId: string): Promise<McpConnectionSummary[]>;
  /**
   * Marks revoked and destroys the wrapped key.
   * @returns the OAuth client ids whose grant must now be dropped (empty when nothing was active).
   */
  revoke(userId: string, connectionId?: string): Promise<string[]>;
}
