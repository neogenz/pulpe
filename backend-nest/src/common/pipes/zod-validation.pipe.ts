import {
  BadRequestException,
  Injectable,
  PipeTransform,
  Logger,
} from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    try {
      const parsedValue = this.schema.parse(value);
      return parsedValue;
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map(
          (err) => `${err.path.join('.')}: ${err.message}`,
        );
        throw new BadRequestException({
          message: 'Validation failed',
          errors: errorMessages,
        });
      }
      throw new BadRequestException('Validation failed');
    }
  }
}

@Injectable()
export class ZodBodyPipe implements PipeTransform {
  private readonly logger = new Logger(ZodBodyPipe.name);

  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        // Log detailed validation error information for debugging
        this.logger.error('Zod validation failed', {
          receivedData: JSON.stringify(value, null, 2),
          validationErrors: error.errors,
          formattedErrors: error.flatten(),
          timestamp: new Date().toISOString(),
        });

        // Also log a simplified version for quick reading
        this.logger.warn(
          `Validation failed for ${error.errors.length} field(s): ${error.errors
            .map((err) => `${err.path.join('.')} (${err.message})`)
            .join(', ')}`,
        );

        throw new BadRequestException({
          message: 'Invalid request body',
          errors: error.flatten(),
        });
      }

      // Log unexpected non-Zod errors
      this.logger.error('Unexpected validation error', {
        error: error instanceof Error ? error.message : String(error),
        receivedData: JSON.stringify(value, null, 2),
        timestamp: new Date().toISOString(),
      });

      throw new BadRequestException('Invalid request body');
    }
  }
}
