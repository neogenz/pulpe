# Health Monitoring Module

This module provides comprehensive health checks and monitoring capabilities for the Pulpe Budget API.

## Features

- **Health Checks**: Database connectivity, memory usage, disk storage
- **Liveness/Readiness Probes**: Kubernetes-compatible health endpoints
- **Application Metrics**: Business metrics, error rates, performance tracking
- **Operation Monitoring**: Track performance of individual operations
- **Graceful Shutdown**: Proper cleanup on service termination

## Endpoints

### Basic Health Check
```
GET /health
```
Returns overall health status including database, memory, and storage checks.

### Liveness Probe
```
GET /health/live
```
Checks if the service is running (memory check only).

### Readiness Probe
```
GET /health/ready
```
Checks if the service can handle requests (database, auth, and memory checks).

### Application Metrics
```
GET /health/metrics
```
Returns detailed application metrics including:
- System uptime
- Memory usage
- Business metrics (budgets, transactions, users)
- Error rates (5min, 1hour, 24hour)

### Operation Statistics
```
GET /health/metrics/operations?operation=<name>&timeRange=<ms>
```
Returns performance statistics for operations:
- Count, success/error rates
- Duration statistics (avg, min, max, percentiles)

### System Overview
```
GET /health/metrics/overview
```
Returns system monitoring overview:
- Recent and hourly activity
- Top operations by count
- Slowest operations by duration

## Usage

### Recording Operations
Services can track operation performance:

```typescript
import { MonitoringService } from '@modules/health';

constructor(private monitoring: MonitoringService) {}

async someOperation() {
  const startTime = Date.now();
  try {
    // ... operation logic
    const duration = Date.now() - startTime;
    this.monitoring.recordOperation('operation_name', duration, true);
  } catch (error) {
    const duration = Date.now() - startTime;
    this.monitoring.recordOperation('operation_name', duration, false);
    throw error;
  }
}
```

### Error Tracking
The health service tracks error rates automatically:

```typescript
import { HealthService } from '@modules/health';

constructor(private health: HealthService) {}

handleError(error: Error) {
  this.health.trackError();
  // ... error handling
}
```

## Configuration

### Memory Thresholds
- Basic health check: 150MB heap/RSS
- Liveness probe: 300MB heap (higher for stability)
- Readiness probe: 200MB heap

### Caching
- Metrics cache TTL: 30 seconds
- Prevents excessive database queries

### Graceful Shutdown
- Timeout: 30 seconds
- Handles SIGTERM, SIGINT, SIGHUP signals
- Executes cleanup callbacks

## Production Deployment

### Kubernetes Configuration
```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
```

### Monitoring Integration
The metrics endpoints can be integrated with monitoring tools:
- Prometheus: Scrape `/health/metrics`
- Grafana: Visualize metrics and create alerts
- Custom dashboards: Use operation stats and system overview

## Testing

Run tests:
```bash
# Unit tests
bun test health.service.spec.ts
bun test monitoring.service.spec.ts
bun test health.controller.spec.ts

# Integration tests
bun test health.integration.spec.ts
```

## Architecture

The module follows the standard NestJS patterns:
- **Controller**: HTTP endpoints and request handling
- **HealthService**: Database and auth health checks, metrics collection
- **MonitoringService**: Operation tracking and performance statistics
- **ShutdownService**: Graceful shutdown handling