import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseMcpOAuthRepository } from '../persistence/supabase-mcp-oauth.repository';
import {
  MCP_ACTIVITY_REPOSITORY,
  type McpActivityRepositoryPort,
} from '../../domain/ports/mcp-activity-repository.port';

const RETENTION_MONTHS = 12;

/** Daily at 03:00 UTC: the privacy policy announces twelve months of agent activity. */
@Injectable()
export class McpActivityPurgeCron {
  constructor(
    @Inject(MCP_ACTIVITY_REPOSITORY)
    private readonly activity: McpActivityRepositoryPort,
    private readonly oauth: SupabaseMcpOAuthRepository,
  ) {}

  @Cron('0 3 * * *')
  async run(): Promise<void> {
    const cutoff = new Date();
    cutoff.setUTCMonth(cutoff.getUTCMonth() - RETENTION_MONTHS);
    await this.activity.purgeOlderThan(cutoff);
    await this.oauth.purgeExpired();
  }
}
