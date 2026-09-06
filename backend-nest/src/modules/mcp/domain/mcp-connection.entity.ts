import type { AccessMode } from './access-mode';

/** A grant written by the consent page: what an agent client may do with one user's vault. */
export interface NewMcpConnection {
  readonly userId: string;
  readonly clientId: string;
  /** As declared by the client to Supabase, never typed by the user. */
  readonly clientName: string;
  readonly mode: AccessMode;
  /** The user's vault key, wrapped with `MCP_WRAPPING_KEY` (base64). */
  readonly wrappedClientKey: string;
}
