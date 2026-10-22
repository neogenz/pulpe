import type { Tag } from '../tag.entity';

export const TAG_READ_PORT = Symbol('TAG_READ_PORT');

/**
 * Read the user's tags, for in-process consumers (the MCP agent connector).
 * Requires the caller to have put `user` and `supabase` in CLS, exactly like an
 * HTTP request does.
 */
export interface TagReadPort {
  list(): Promise<Tag[]>;
}
