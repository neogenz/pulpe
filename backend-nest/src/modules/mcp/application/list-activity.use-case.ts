import { Inject, Injectable } from '@nestjs/common';
import type { McpActivity } from '../domain/mcp-activity.entity';
import {
  MCP_ACTIVITY_REPOSITORY,
  type McpActivityPage,
  type McpActivityRepositoryPort,
} from '../domain/ports/mcp-activity-repository.port';

@Injectable()
export class ListActivityUseCase {
  constructor(
    @Inject(MCP_ACTIVITY_REPOSITORY)
    private readonly activity: McpActivityRepositoryPort,
  ) {}

  execute(
    userId: string,
    connectionId: string,
    page: McpActivityPage,
  ): Promise<McpActivity[]> {
    return this.activity.listByConnection(userId, connectionId, page);
  }
}
