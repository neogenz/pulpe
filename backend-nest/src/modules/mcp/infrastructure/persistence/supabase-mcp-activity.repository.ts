import { Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { SupabaseService } from '@modules/supabase/supabase.service';
import type {
  McpActivity,
  NewMcpActivity,
} from '../../domain/mcp-activity.entity';
import type {
  McpActivityPage,
  McpActivityRepositoryPort,
} from '../../domain/ports/mcp-activity-repository.port';

const MAX_PAGE = 100;

/** Service-role table. A failed write is logged, never surfaced: the tool call already happened. */
@Injectable()
export class SupabaseMcpActivityRepository implements McpActivityRepositoryPort {
  constructor(
    private readonly supabaseService: SupabaseService,
    @InjectInfoLogger(SupabaseMcpActivityRepository.name)
    private readonly logger: InfoLogger,
  ) {}

  async record(activity: NewMcpActivity): Promise<void> {
    const { error } = await this.#table().insert({
      connection_id: activity.connectionId,
      user_id: activity.userId,
      tool: activity.tool,
      outcome: activity.outcome,
    });
    if (error) {
      this.logger.warn(
        { operation: 'mcpActivity.record', userId: activity.userId },
        'Agent activity could not be recorded',
      );
    }
  }

  async listByConnection(
    userId: string,
    connectionId: string,
    page: McpActivityPage,
  ): Promise<McpActivity[]> {
    let query = this.#table()
      .select('tool, outcome, created_at')
      .eq('user_id', userId)
      .eq('connection_id', connectionId)
      .order('created_at', { ascending: false })
      .limit(Math.min(page.limit, MAX_PAGE));
    if (page.before) query = query.lt('created_at', page.before);
    const { data, error } = await query;
    if (error) {
      this.logger.warn(
        { operation: 'mcpActivity.list', userId },
        'Agent activity could not be read',
      );
      return [];
    }
    return data.map((row) => ({
      tool: row.tool,
      outcome: row.outcome === 'error' ? 'error' : 'ok',
      createdAt: row.created_at,
    }));
  }

  async purgeOlderThan(date: Date): Promise<void> {
    const { error } = await this.#table()
      .delete()
      .lt('created_at', date.toISOString());
    if (error) {
      this.logger.warn(
        { operation: 'mcpActivity.purge' },
        'Agent activity purge failed',
      );
    }
  }

  #table() {
    return this.supabaseService.getServiceRoleClient().from('mcp_activity');
  }
}
