import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { SupabaseService } from '../supabase/supabase.service';
import { PinoLogger } from 'nestjs-pino';

interface ApplicationMetrics {
  uptime: number;
  timestamp: string;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
  business: {
    totalBudgets: number;
    totalTransactions: number;
    totalUsers: number; // Now represents total templates
    recentActivity: {
      budgetsCreated24h: number;
      transactionsCreated24h: number;
      usersRegistered24h: number; // Now represents templates created
    };
  };
  errors: {
    rate5min: number;
    rate1hour: number;
    rate24hour: number;
  };
}

@Injectable()
export class HealthService extends HealthIndicator {
  #errorCounts: { timestamp: number; count: number }[] = [];
  #metricsCacheTime = 0;
  #metricsCache: ApplicationMetrics | null = null;
  #METRICS_CACHE_TTL = 30000; // 30 seconds

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(HealthService.name);
  }

  async checkDatabase(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();

    try {
      const client = this.supabaseService.getClient();

      // Simple query to check database connectivity
      const { data: _data, error } = await client
        .from('monthly_budget')
        .select('id')
        .limit(1);

      if (error) {
        throw new HealthCheckError(
          'Database check failed',
          this.getStatus(key, false, { error: error.message }),
        );
      }

      const duration = Date.now() - startTime;
      this.logger.debug(
        {
          operation: 'check_database',
          duration,
        },
        'Database health check passed',
      );

      return this.getStatus(key, true, { responseTime: duration });
    } catch {
      const duration = Date.now() - startTime;
      this.logger.error(
        {
          operation: 'check_database',
          duration,
          err: error,
        },
        'Database health check failed',
      );

      throw new HealthCheckError(
        'Database check failed',
        this.getStatus(key, false, {
          error: error instanceof Error ? error.message : 'Unknown error',
          responseTime: duration,
        }),
      );
    }
  }

  async checkSupabaseAuth(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();

    try {
      const client = this.supabaseService.getClient();

      // Check if auth service is accessible
      const {
        data: { session },
      } = await client.auth.getSession();

      const duration = Date.now() - startTime;
      this.logger.debug(
        {
          operation: 'check_supabase_auth',
          duration,
        },
        'Supabase auth health check passed',
      );

      return this.getStatus(key, true, {
        responseTime: duration,
        sessionActive: !!session,
      });
    } catch {
      const duration = Date.now() - startTime;
      this.logger.error(
        {
          operation: 'check_supabase_auth',
          duration,
          err: error,
        },
        'Supabase auth health check failed',
      );

      throw new HealthCheckError(
        'Supabase auth check failed',
        this.getStatus(key, false, {
          error: error instanceof Error ? error.message : 'Unknown error',
          responseTime: duration,
        }),
      );
    }
  }

  // eslint-disable-next-line max-lines-per-function
  async getApplicationMetrics(): Promise<ApplicationMetrics> {
    const now = Date.now();

    // Return cached metrics if still valid
    if (
      this.#metricsCache &&
      now - this.#metricsCacheTime < this.#METRICS_CACHE_TTL
    ) {
      return this.#metricsCache;
    }

    const startTime = now;

    try {
      const memoryUsage = process.memoryUsage();
      const client = this.supabaseService.getClient();

      // Get business metrics
      const [budgetsResult, transactionsResult, templatesResult] =
        await Promise.all([
          client
            .from('monthly_budget')
            .select('id', { count: 'exact', head: true }),
          client
            .from('transaction')
            .select('id', { count: 'exact', head: true }),
          client.from('template').select('id', { count: 'exact', head: true }),
        ]);

      // Get recent activity (last 24 hours)
      const twentyFourHoursAgo = new Date(
        now - 24 * 60 * 60 * 1000,
      ).toISOString();

      const [recentBudgets, recentTransactions, recentTemplates] =
        await Promise.all([
          client
            .from('monthly_budget')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', twentyFourHoursAgo),
          client
            .from('transaction')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', twentyFourHoursAgo),
          client
            .from('template')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', twentyFourHoursAgo),
        ]);

      // Calculate error rates
      this.#cleanupOldErrors();
      const errorRates = this.#calculateErrorRates(now);

      const metrics: ApplicationMetrics = {
        uptime: process.uptime(),
        timestamp: new Date(now).toISOString(),
        memory: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          rss: memoryUsage.rss,
          external: memoryUsage.external,
        },
        business: {
          totalBudgets: budgetsResult.count || 0,
          totalTransactions: transactionsResult.count || 0,
          totalUsers: templatesResult.count || 0,
          recentActivity: {
            budgetsCreated24h: recentBudgets.count || 0,
            transactionsCreated24h: recentTransactions.count || 0,
            usersRegistered24h: recentTemplates.count || 0,
          },
        },
        errors: errorRates,
      };

      // Cache the metrics
      this.#metricsCache = metrics;
      this.#metricsCacheTime = now;

      const duration = Date.now() - startTime;
      this.logger.info(
        {
          operation: 'get_application_metrics',
          duration,
        },
        'Application metrics collected successfully',
      );

      return metrics;
    } catch {
      const duration = Date.now() - startTime;
      this.logger.error(
        {
          operation: 'get_application_metrics',
          duration,
          err: error,
        },
        'Failed to collect application metrics',
      );

      // Return partial metrics even on error
      return {
        uptime: process.uptime(),
        timestamp: new Date(now).toISOString(),
        memory: process.memoryUsage(),
        business: {
          totalBudgets: 0,
          totalTransactions: 0,
          totalUsers: 0,
          recentActivity: {
            budgetsCreated24h: 0,
            transactionsCreated24h: 0,
            usersRegistered24h: 0,
          },
        },
        errors: this.#calculateErrorRates(now),
      };
    }
  }

  trackError(): void {
    this.#errorCounts.push({ timestamp: Date.now(), count: 1 });
  }

  #cleanupOldErrors(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.#errorCounts = this.#errorCounts.filter(
      (e) => e.timestamp > oneHourAgo,
    );
  }

  #calculateErrorRates(now: number): {
    rate5min: number;
    rate1hour: number;
    rate24hour: number;
  } {
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    const errors5min = this.#errorCounts.filter(
      (e) => e.timestamp > fiveMinutesAgo,
    ).length;
    const errors1hour = this.#errorCounts.filter(
      (e) => e.timestamp > oneHourAgo,
    ).length;
    const errors24hour = this.#errorCounts.filter(
      (e) => e.timestamp > twentyFourHoursAgo,
    ).length;

    return {
      rate5min: errors5min,
      rate1hour: errors1hour,
      rate24hour: errors24hour,
    };
  }
}
