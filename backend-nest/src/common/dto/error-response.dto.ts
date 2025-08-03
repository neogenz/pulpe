import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Error context information schema
 */
const ErrorContextSchema = z.object({
  requestId: z.string().optional(),
  userId: z.string().optional(),
  userAgent: z.string().optional(),
  ip: z.string().optional(),
});

/**
 * Base error response schema
 */
const ErrorResponseSchema = z.object({
  success: z.literal(false),
  statusCode: z.number().int().min(400).max(599),
  timestamp: z.string().datetime(),
  path: z.string(),
  method: z.string(),
  message: z.union([z.string(), z.record(z.unknown())]),
  error: z.string(),
  code: z.string(),
  context: ErrorContextSchema.optional(),
  stack: z.string().optional(),
});

/**
 * Validation error details schema
 */
const ValidationErrorDetailSchema = z.object({
  field: z.string(),
  message: z.string(),
  code: z.string().optional(),
  value: z.unknown().optional(),
});

/**
 * Validation error response schema
 */
const ValidationErrorResponseSchema = ErrorResponseSchema.extend({
  errors: z.array(ValidationErrorDetailSchema).optional(),
  details: z.record(z.array(z.string())).optional(),
});

/**
 * Error context DTO for Swagger
 */
export class ErrorContextDto extends createZodDto(ErrorContextSchema) {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  override requestId?: string;

  @ApiProperty({ example: 'user_123' })
  override userId?: string;

  @ApiProperty({ example: 'Mozilla/5.0...' })
  override userAgent?: string;

  @ApiProperty({ example: '192.168.1.1' })
  override ip?: string;
}

/**
 * Base error response DTO for Swagger
 */
export class ErrorResponseDto extends createZodDto(ErrorResponseSchema) {
  @ApiProperty({ example: false })
  override success!: false;

  @ApiProperty({ example: 400, minimum: 400, maximum: 599 })
  override statusCode!: number;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  override timestamp!: string;

  @ApiProperty({ example: '/api/v1/budgets' })
  override path!: string;

  @ApiProperty({ example: 'POST' })
  override method!: string;

  @ApiProperty({
    example: 'Validation failed',
    oneOf: [{ type: 'string' }, { type: 'object' }],
  })
  override message!: string | Record<string, unknown>;

  @ApiProperty({ example: 'ValidationException' })
  override error!: string;

  @ApiProperty({ example: 'VALIDATION_FAILED' })
  override code!: string;

  @ApiProperty({ required: false })
  override context?: ErrorContextDto;

  @ApiProperty({
    required: false,
    description: 'Stack trace (development only)',
  })
  override stack?: string;
}

/**
 * Validation error detail DTO
 */
export class ValidationErrorDetailDto extends createZodDto(
  ValidationErrorDetailSchema,
) {
  @ApiProperty({ example: 'email' })
  override field!: string;

  @ApiProperty({ example: 'Invalid email format' })
  override message!: string;

  @ApiProperty({ example: 'INVALID_FORMAT', required: false })
  override code?: string;

  @ApiProperty({ example: 'not-an-email', required: false })
  override value?: unknown;
}

/**
 * Validation error response DTO for Swagger
 */
export class ValidationErrorResponseDto extends createZodDto(
  ValidationErrorResponseSchema,
) {
  @ApiProperty({ example: false })
  override success!: false;

  @ApiProperty({ example: 400 })
  override statusCode!: number;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  override timestamp!: string;

  @ApiProperty({ example: '/api/v1/budgets' })
  override path!: string;

  @ApiProperty({ example: 'POST' })
  override method!: string;

  @ApiProperty({ example: 'Validation failed' })
  override message!: string | Record<string, unknown>;

  @ApiProperty({ example: 'ValidationException' })
  override error!: string;

  @ApiProperty({ example: 'VALIDATION_FAILED' })
  override code!: string;

  @ApiProperty({ required: false })
  override context?: ErrorContextDto;

  @ApiProperty({
    type: [ValidationErrorDetailDto],
    required: false,
    description: 'Detailed validation errors',
  })
  override errors?: ValidationErrorDetailDto[];

  @ApiProperty({
    required: false,
    description: 'Legacy validation error format',
    example: { email: ['Invalid email format'], amount: ['Must be positive'] },
  })
  override details?: Record<string, string[]>;
}

/**
 * Common error response examples for Swagger documentation
 */
export const ErrorResponseExamples = {
  BadRequest: {
    description: 'Bad Request',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 400,
          timestamp: '2024-01-01T00:00:00.000Z',
          path: '/api/v1/budgets',
          method: 'POST',
          message: 'Invalid input provided',
          error: 'BadRequestException',
          code: 'INVALID_INPUT',
          context: {
            requestId: '123e4567-e89b-12d3-a456-426614174000',
          },
        },
      },
    },
  },
  ValidationError: {
    description: 'Validation Error',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 400,
          timestamp: '2024-01-01T00:00:00.000Z',
          path: '/api/v1/budgets',
          method: 'POST',
          message: 'Validation failed',
          error: 'ValidationException',
          code: 'VALIDATION_FAILED',
          errors: [
            {
              field: 'name',
              message: 'Name is required',
              code: 'MISSING_REQUIRED_FIELD',
            },
            {
              field: 'amount',
              message: 'Amount must be positive',
              code: 'OUT_OF_RANGE',
              value: -100,
            },
          ],
        },
      },
    },
  },
  Unauthorized: {
    description: 'Unauthorized',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 401,
          timestamp: '2024-01-01T00:00:00.000Z',
          path: '/api/v1/budgets',
          method: 'GET',
          message: 'Authentication required',
          error: 'UnauthorizedException',
          code: 'UNAUTHORIZED',
        },
      },
    },
  },
  Forbidden: {
    description: 'Forbidden',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 403,
          timestamp: '2024-01-01T00:00:00.000Z',
          path: '/api/v1/budgets/123',
          method: 'DELETE',
          message: 'Access forbidden',
          error: 'ForbiddenException',
          code: 'FORBIDDEN',
          context: {
            userId: 'user_123',
          },
        },
      },
    },
  },
  NotFound: {
    description: 'Not Found',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 404,
          timestamp: '2024-01-01T00:00:00.000Z',
          path: '/api/v1/budgets/123',
          method: 'GET',
          message: 'Budget with id 123 not found',
          error: 'EntityNotFoundException',
          code: 'BUDGET_NOT_FOUND',
        },
      },
    },
  },
  Conflict: {
    description: 'Conflict',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 409,
          timestamp: '2024-01-01T00:00:00.000Z',
          path: '/api/v1/budgets',
          method: 'POST',
          message: 'Budget already exists for this month',
          error: 'ConflictException',
          code: 'DUPLICATE_RESOURCE',
        },
      },
    },
  },
  UnprocessableEntity: {
    description: 'Unprocessable Entity',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 422,
          timestamp: '2024-01-01T00:00:00.000Z',
          path: '/api/v1/transactions',
          method: 'POST',
          message: 'Insufficient funds for this transaction',
          error: 'BusinessRuleViolationException',
          code: 'INSUFFICIENT_FUNDS',
        },
      },
    },
  },
  InternalServerError: {
    description: 'Internal Server Error',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 500,
          timestamp: '2024-01-01T00:00:00.000Z',
          path: '/api/v1/budgets',
          method: 'POST',
          message: 'Internal server error',
          error: 'InternalServerErrorException',
          code: 'INTERNAL_SERVER_ERROR',
          context: {
            requestId: '123e4567-e89b-12d3-a456-426614174000',
          },
        },
      },
    },
  },
};
