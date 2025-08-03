import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

interface PerformanceMetric {
  operation: string;
  timestamp: number;
  duration: number;
  success: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

interface OperationStats {
  count: number;
  successCount: number;
  errorCount: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
}

@Injectable()
export class MonitoringService implements OnModuleDestroy {
  #metrics: PerformanceMetric[] = [];
  #cleanupInterval: NodeJS.Timeout;
  #METRICS_RETENTION_PERIOD = 60 * 60 * 1000; // 1 hour
  #CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(MonitoringService.name);
    this.#startCleanupInterval();
  }

  onModuleDestroy() {
    if (this.#cleanupInterval) {
      clearInterval(this.#cleanupInterval);
    }
  }

  recordOperation(
    operation: string,
    duration: number,
    success: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>,
  ): void {
    const metric: PerformanceMetric = {
      operation,
      timestamp: Date.now(),
      duration,
      success,
      metadata,
    };

    this.#metrics.push(metric);

    // Log slow operations
    if (duration > 1000) {
      this.logger.warn(
        {
          operation,
          duration,
          success,
          metadata,
        },
        'Slow operation detected',
      );
    }
  }

  getOperationStats(
    operation: string,
    timeRangeMs = 60 * 60 * 1000,
  ): OperationStats {
    const now = Date.now();
    const cutoff = now - timeRangeMs;

    const relevantMetrics = this.#metrics
      .filter((m) => m.operation === operation && m.timestamp > cutoff)
      .sort((a, b) => a.duration - b.duration);

    if (relevantMetrics.length === 0) {
      return {
        count: 0,
        successCount: 0,
        errorCount: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        p50Duration: 0,
        p95Duration: 0,
        p99Duration: 0,
      };
    }

    const count = relevantMetrics.length;
    const successCount = relevantMetrics.filter((m) => m.success).length;
    const errorCount = count - successCount;
    const totalDuration = relevantMetrics.reduce(
      (sum, m) => sum + m.duration,
      0,
    );
    const avgDuration = totalDuration / count;
    const minDuration = relevantMetrics[0].duration;
    const maxDuration = relevantMetrics[count - 1].duration;

    // Calculate percentiles
    const p50Index = Math.floor(count * 0.5);
    const p95Index = Math.floor(count * 0.95);
    const p99Index = Math.floor(count * 0.99);

    return {
      count,
      successCount,
      errorCount,
      avgDuration: Math.round(avgDuration),
      minDuration,
      maxDuration,
      p50Duration: relevantMetrics[p50Index].duration,
      p95Duration: relevantMetrics[p95Index]?.duration || maxDuration,
      p99Duration: relevantMetrics[p99Index]?.duration || maxDuration,
    };
  }

  getAllOperationStats(
    timeRangeMs = 60 * 60 * 1000,
  ): Record<string, OperationStats> {
    const operations = new Set(this.#metrics.map((m) => m.operation));
    const stats: Record<string, OperationStats> = {};

    for (const operation of operations) {
      stats[operation] = this.getOperationStats(operation, timeRangeMs);
    }

    return stats;
  }

  getSystemOverview() {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;

    const recentMetrics = this.#metrics.filter(
      (m) => m.timestamp > fiveMinutesAgo,
    );
    const hourlyMetrics = this.#metrics.filter((m) => m.timestamp > oneHourAgo);

    const recentErrors = recentMetrics.filter((m) => !m.success).length;
    const hourlyErrors = hourlyMetrics.filter((m) => !m.success).length;

    const recentSuccessRate =
      recentMetrics.length > 0
        ? ((recentMetrics.length - recentErrors) / recentMetrics.length) * 100
        : 100;

    const hourlySuccessRate =
      hourlyMetrics.length > 0
        ? ((hourlyMetrics.length - hourlyErrors) / hourlyMetrics.length) * 100
        : 100;

    return {
      timestamp: new Date(now).toISOString(),
      recentActivity: {
        operations: recentMetrics.length,
        errors: recentErrors,
        successRate: Math.round(recentSuccessRate * 100) / 100,
      },
      hourlyActivity: {
        operations: hourlyMetrics.length,
        errors: hourlyErrors,
        successRate: Math.round(hourlySuccessRate * 100) / 100,
      },
      topOperations: this.#getTopOperations(oneHourAgo),
      slowestOperations: this.#getSlowestOperations(oneHourAgo),
    };
  }

  #getTopOperations(
    since: number,
    limit = 5,
  ): Array<{ operation: string; count: number }> {
    const operationCounts = new Map<string, number>();

    this.#metrics
      .filter((m) => m.timestamp > since)
      .forEach((m) => {
        operationCounts.set(
          m.operation,
          (operationCounts.get(m.operation) || 0) + 1,
        );
      });

    return Array.from(operationCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([operation, count]) => ({ operation, count }));
  }

  #getSlowestOperations(
    since: number,
    limit = 5,
  ): Array<{ operation: string; avgDuration: number }> {
    const operationDurations = new Map<
      string,
      { total: number; count: number }
    >();

    this.#metrics
      .filter((m) => m.timestamp > since)
      .forEach((m) => {
        const current = operationDurations.get(m.operation) || {
          total: 0,
          count: 0,
        };
        operationDurations.set(m.operation, {
          total: current.total + m.duration,
          count: current.count + 1,
        });
      });

    return Array.from(operationDurations.entries())
      .map(([operation, { total, count }]) => ({
        operation,
        avgDuration: Math.round(total / count),
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, limit);
  }

  #startCleanupInterval(): void {
    this.#cleanupInterval = setInterval(() => {
      const cutoff = Date.now() - this.#METRICS_RETENTION_PERIOD;
      const beforeCount = this.#metrics.length;

      this.#metrics = this.#metrics.filter((m) => m.timestamp > cutoff);

      const removed = beforeCount - this.#metrics.length;
      if (removed > 0) {
        this.logger.debug(
          {
            operation: 'metrics_cleanup',
            removed,
            remaining: this.#metrics.length,
          },
          'Cleaned up old metrics',
        );
      }
    }, this.#CLEANUP_INTERVAL);
  }
}
