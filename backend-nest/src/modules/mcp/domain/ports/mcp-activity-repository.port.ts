import type { McpActivity, NewMcpActivity } from '../mcp-activity.entity';

export const MCP_ACTIVITY_REPOSITORY = Symbol('MCP_ACTIVITY_REPOSITORY');

export interface McpActivityPage {
  readonly limit: number;
  /** Keyset cursor: only entries strictly older than this ISO date. */
  readonly before?: string;
}

export interface McpActivityRepositoryPort {
  record(activity: NewMcpActivity): Promise<void>;
  /** Newest first. Scoped by `userId` so a foreign connection id reads as empty. */
  listByConnection(
    userId: string,
    connectionId: string,
    page: McpActivityPage,
  ): Promise<McpActivity[]>;
  /** Retention: the privacy policy announces twelve months. */
  purgeOlderThan(date: Date): Promise<void>;
}
