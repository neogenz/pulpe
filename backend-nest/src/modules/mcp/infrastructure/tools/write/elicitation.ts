import type { McpToolResult } from '../../../domain/mcp-tool.entity';

/**
 * A missing piece of information comes back as a question, never as a guess.
 *
 * The MCP `elicitation/create` request needs a session the server can write
 * back into; our transport is a stateless HTTP POST, one server per request, so
 * there is no such channel. The tool answers with the question instead: the
 * model relays it to the user and calls the tool again with the answer, which
 * is the same conversation, one round-trip later.
 *
 * The reply is flagged `wrote: false` so the activity log skips it. Return it
 * before any port call, never after a write, or a real write disappears from
 * the log.
 */
export const askUser = (question: string): McpToolResult => ({
  text: `Information manquante. Demande à l’utilisateur : ${question}`,
  wrote: false,
});
