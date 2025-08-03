import { Controller, Get, Query } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  DiskHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { MonitoringService } from './monitoring.service';
import { PinoLogger } from 'nestjs-pino';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly disk: DiskHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly healthService: HealthService,
    private readonly monitoringService: MonitoringService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(HealthController.name);
  }

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async check() {
    const startTime = Date.now();

    try {
      const result = await this.health.check([
        () => this.healthService.checkDatabase('database'),
        () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024), // 150MB
        () => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024), // 150MB
        () =>
          this.disk.checkStorage('storage', {
            path: '/',
            thresholdPercent: 0.9,
          }),
      ]);

      const duration = Date.now() - startTime;
      this.logger.info(
        {
          operation: 'health_check',
          duration,
          status: result.status,
        },
        'Health check completed',
      );

      return result;
    } catch {
      const duration = Date.now() - startTime;
      this.logger.error(
        {
          operation: 'health_check',
          duration,
          err: error,
        },
        'Health check failed',
      );
      throw error;
    }
  }

  @Get('live')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness probe - checks if service is running' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  @ApiResponse({ status: 503, description: 'Service is not alive' })
  async checkLiveness() {
    const startTime = Date.now();

    try {
      const result = await this.health.check([
        () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024), // 300MB - higher threshold for liveness
      ]);

      const duration = Date.now() - startTime;
      this.logger.debug(
        {
          operation: 'liveness_check',
          duration,
          status: result.status,
        },
        'Liveness check completed',
      );

      return result;
    } catch {
      const duration = Date.now() - startTime;
      this.logger.error(
        {
          operation: 'liveness_check',
          duration,
          err: error,
        },
        'Liveness check failed',
      );
      throw error;
    }
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness probe - checks if service can handle requests',
  })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async checkReadiness() {
    const startTime = Date.now();

    try {
      const result = await this.health.check([
        () => this.healthService.checkDatabase('database'),
        () => this.healthService.checkSupabaseAuth('supabase_auth'),
        () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024), // 200MB
      ]);

      const duration = Date.now() - startTime;
      this.logger.debug(
        {
          operation: 'readiness_check',
          duration,
          status: result.status,
        },
        'Readiness check completed',
      );

      return result;
    } catch {
      const duration = Date.now() - startTime;
      this.logger.error(
        {
          operation: 'readiness_check',
          duration,
          err: error,
        },
        'Readiness check failed',
      );
      throw error;
    }
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get application metrics' })
  @ApiResponse({ status: 200, description: 'Metrics retrieved successfully' })
  async getMetrics() {
    const startTime = Date.now();

    try {
      const metrics = await this.healthService.getApplicationMetrics();

      const duration = Date.now() - startTime;
      this.logger.debug(
        {
          operation: 'get_metrics',
          duration,
        },
        'Metrics retrieved successfully',
      );

      return metrics;
    } catch {
      const duration = Date.now() - startTime;
      this.logger.error(
        {
          operation: 'get_metrics',
          duration,
          err: error,
        },
        'Failed to retrieve metrics',
      );
      throw error;
    }
  }

  @Get('metrics/operations')
  @ApiOperation({ summary: 'Get operation performance statistics' })
  @ApiResponse({
    status: 200,
    description: 'Operation stats retrieved successfully',
  })
  @ApiQuery({
    name: 'operation',
    required: false,
    description: 'Specific operation to get stats for',
  })
  @ApiQuery({
    name: 'timeRange',
    required: false,
    description: 'Time range in milliseconds (default: 3600000)',
  })
  async getOperationStats(
    @Query('operation') operation?: string,
    @Query('timeRange') timeRange?: string,
  ) {
    const startTime = Date.now();
    const timeRangeMs = timeRange ? parseInt(timeRange, 10) : 60 * 60 * 1000;

    try {
      const stats = operation
        ? {
            [operation]: this.monitoringService.getOperationStats(
              operation,
              timeRangeMs,
            ),
          }
        : this.monitoringService.getAllOperationStats(timeRangeMs);

      const duration = Date.now() - startTime;
      this.logger.debug(
        {
          operation: 'get_operation_stats',
          duration,
          statsCount: Object.keys(stats).length,
        },
        'Operation stats retrieved successfully',
      );

      return stats;
    } catch {
      const duration = Date.now() - startTime;
      this.logger.error(
        {
          operation: 'get_operation_stats',
          duration,
          err: error,
        },
        'Failed to retrieve operation stats',
      );
      throw error;
    }
  }

  @Get('metrics/overview')
  @ApiOperation({ summary: 'Get system monitoring overview' })
  @ApiResponse({
    status: 200,
    description: 'System overview retrieved successfully',
  })
  async getSystemOverview() {
    const startTime = Date.now();

    try {
      const overview = this.monitoringService.getSystemOverview();

      const duration = Date.now() - startTime;
      this.logger.debug(
        {
          operation: 'get_system_overview',
          duration,
        },
        'System overview retrieved successfully',
      );

      return overview;
    } catch {
      const duration = Date.now() - startTime;
      this.logger.error(
        {
          operation: 'get_system_overview',
          duration,
          err: error,
        },
        'Failed to retrieve system overview',
      );
      throw error;
    }
  }
}
