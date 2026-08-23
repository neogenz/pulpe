import type { Buffer } from 'node:buffer';
import type { AccessMode } from '../access-mode';
import type { NewMcpConnection } from '../mcp-connection.entity';

export const MCP_CONNECTION_REPOSITORY = Symbol('MCP_CONNECTION_REPOSITORY');

/** An active grant between one user and one OAuth client. Key `(userId, clientId)`. */
export interface ActiveMcpConnection {
  readonly clientId: string;
  readonly mode: AccessMode;
  /** 32-byte vault key, already unwrapped. Zeroed by the caller after the request. */
  readonly clientKey: Buffer;
}

export interface McpConnectionRepositoryPort {
  /** `null` when the pair has no connection or it was revoked: the caller answers 401. */
  findActive(
    userId: string,
    clientId: string,
  ): Promise<ActiveMcpConnection | null>;
  /** Create or re-authorize the `(userId, clientId)` pair: new key, new mode, revocation cleared. */
  save(connection: NewMcpConnection): Promise<void>;
}
