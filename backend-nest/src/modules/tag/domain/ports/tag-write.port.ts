import type { Tag } from '../tag.entity';

export const TAG_WRITE_PORT = Symbol('TAG_WRITE_PORT');

/**
 * Create, rename and delete the user's tags, for in-process consumers (the MCP
 * agent connector). Requires the caller to have put `user` and `supabase` in
 * CLS, exactly like an HTTP request does.
 *
 * `rename` and `remove` reject with `TAG_NOT_FOUND` on an unknown id; `create`
 * and `rename` reject with `TAG_ALREADY_EXISTS` when the name is taken, case
 * ignored.
 */
export interface TagWritePort {
  create(name: string): Promise<Tag>;
  rename(id: string, name: string): Promise<Tag>;
  remove(id: string): Promise<void>;
}
