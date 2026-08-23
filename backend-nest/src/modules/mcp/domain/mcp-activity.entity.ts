/** One write gesture made by an agent: the tool, not its content. */
export type McpActivityOutcome = 'ok' | 'error';

export interface McpActivity {
  readonly tool: string;
  readonly outcome: McpActivityOutcome;
  readonly createdAt: string;
}

export interface NewMcpActivity {
  readonly connectionId: string;
  readonly userId: string;
  readonly tool: string;
  readonly outcome: McpActivityOutcome;
}
