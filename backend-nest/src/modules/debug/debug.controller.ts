import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { ZodValidationException } from 'nestjs-zod';
import { z, ZodError } from 'zod';

@ApiTags('Debug')
@Controller({ path: 'debug', version: '1' })
export class DebugController {
  constructor(
    @InjectPinoLogger(DebugController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Get('test-error/:type')
  @ApiOperation({
    summary: 'Test different error types',
    description:
      'Generate different types of errors for testing error handling',
  })
  testError(@Param('type') type: string, @Query('message') message?: string) {
    const errorMessage = message || `Test ${type} error`;

    switch (type) {
      case 'validation':
        throw this.createValidationError(errorMessage);
      case 'zod':
        throw this.createZodValidationError();
      case 'not-found':
        throw this.createNotFoundError(errorMessage);
      case 'database':
        throw this.createDatabaseError(errorMessage);
      case 'async':
        return this.simulateAsyncError(errorMessage);
      case 'unknown':
        throw 'This is a string error, not an Error object';
      case 'null':
        throw null;
      case 'undefined':
        throw undefined;
      case 'custom':
        throw this.createCustomError(errorMessage);
      default:
        throw new Error(`Unknown error type: ${type}`);
    }
  }

  private createValidationError(message: string): Error {
    return new Error(`Validation failed: ${message}`);
  }

  private createNotFoundError(message: string): Error {
    const error = new Error(`Resource not found: ${message}`);
    error.name = 'NotFoundException';
    return error;
  }

  private createDatabaseError(message: string): Error {
    const dbError = new Error(`Database connection failed: ${message}`);
    dbError.name = 'DatabaseException';
    (dbError as Error & { cause?: unknown }).cause =
      'Connection timeout after 5000ms';
    return dbError;
  }

  private createCustomError(message: string): Error {
    const customError = new Error(message);
    customError.name = 'CustomBusinessError';
    customError.stack = `CustomBusinessError: ${message}\n    at DebugController.testError (/app/debug.controller.ts:42:25)\n    at /app/node_modules/express/lib/router/route.js:144:13`;
    return customError;
  }

  private createZodValidationError(): ZodValidationException {
    // Create a real ZodError by triggering validation failure
    const testSchema = z.object({
      amount: z.number().positive(),
      name: z.string(),
    });
    const result = testSchema.safeParse({ amount: -1, name: 123 });
    if (!result.success) {
      return new ZodValidationException(result.error);
    }
    // Fallback (should never reach here)
    return new ZodValidationException(new ZodError([]));
  }

  @Post('test-service-error')
  @ApiOperation({
    summary: 'Test service layer error',
    description: 'Generate an error from a service method call',
  })
  async testServiceError(
    @Body() data: { shouldFail: boolean; message?: string },
  ) {
    await this.simulateServiceCall(data.shouldFail, data.message);
    return { success: true, message: 'Service call completed successfully' };
  }

  private async simulateAsyncError(message: string): Promise<never> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    throw new Error(`Async error: ${message}`);
  }

  private async simulateServiceCall(
    shouldFail: boolean,
    message?: string,
  ): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 50));

    if (shouldFail) {
      const serviceError = new Error(message || 'Service operation failed');
      serviceError.name = 'ServiceException';

      // Add some nested stack trace simulation
      const cause = new Error('Underlying database constraint violation');
      cause.name = 'DatabaseConstraintError';
      (serviceError as Error & { cause?: unknown }).cause = cause.message;

      throw serviceError;
    }

    return 'Service operation completed successfully';
  }

  @Get('test-log-levels')
  @ApiOperation({
    summary: 'Test different log levels',
    description: 'Generate logs at different levels for testing',
  })
  testLogLevels() {
    this.logger.debug(
      {
        feature: 'logging-test',
        level: 'debug',
      },
      'This is a debug message',
    );

    this.logger.info(
      {
        feature: 'logging-test',
        level: 'info',
      },
      'This is an info message',
    );

    this.logger.warn(
      {
        feature: 'logging-test',
        level: 'warning',
      },
      'This is a warning message',
    );

    return { message: 'Log levels tested - check console output' };
  }
}
