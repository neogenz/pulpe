/** What an agent connection may do. Lives on `mcp_connection`, never in a JWT claim. */
export type AccessMode = 'read' | 'read_write';

export const ACCESS_MODES: readonly AccessMode[] = ['read', 'read_write'];

export function isAccessMode(value: unknown): value is AccessMode {
  return ACCESS_MODES.includes(value as AccessMode);
}

/** A `read_write` connection may use every tool; a `read` one only read tools. */
export function allowsTool(mode: AccessMode, toolMode: AccessMode): boolean {
  return mode === 'read_write' || toolMode === 'read';
}
