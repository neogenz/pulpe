import type { AccessMode } from './access-mode';

/** MCP `ToolAnnotations`, declared per tool, never inferred. */
export interface McpToolAnnotations {
  readonly readOnlyHint: boolean;
  readonly destructiveHint: boolean;
  readonly idempotentHint: boolean;
  /** Always false: every tool acts on the user's Pulpe data only. */
  readonly openWorldHint: false;
}

export interface McpToolResult {
  /** Plain text rendered to the model. Never the raw entity. */
  readonly text: string;
}

export interface McpTool<Args = Record<string, unknown>> {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  /** Minimal connection mode required to list and call this tool. */
  readonly mode: AccessMode;
  readonly annotations: McpToolAnnotations;
  /** Zod raw shape, typed loosely so the domain stays free of zod. */
  readonly inputSchema: Record<string, unknown>;
  execute(args: Args): Promise<McpToolResult>;
}
