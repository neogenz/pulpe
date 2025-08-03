/**
 * Central export for all error handling utilities
 * This module provides comprehensive error handling for the application
 */

// Domain exceptions
export * from '@/shared/domain/exceptions/domain.exception';

// Error codes and constants
export {
  ErrorCode,
  ErrorCodeToStatus,
  ErrorCodeMessages,
} from '../constants/error-codes.enum';
export { ErrorDictionary } from '../constants/error-codes';

// Error response DTOs
export {
  ErrorResponseDto,
  ValidationErrorResponseDto,
  ErrorContextDto,
  ValidationErrorDetailDto,
  ErrorResponseExamples,
} from '../dto/error-response.dto';

// Error handling utilities
export {
  ErrorMapper,
  type ErrorMappingConfig,
  type MappedError,
} from '../utils/error-mapper';
export {
  ErrorHandler,
  type ErrorHandlingContext,
  type ErrorHandlingOptions,
} from '../utils/error-handler';

// Exception filters
export { GlobalExceptionFilter } from '../filters/global-exception.filter';
export { GlobalExceptionFilterEnhanced } from '../filters/global-exception.filter.enhanced';

/**
 * Quick start guide for error handling:
 *
 * 1. In your service, inject PinoLogger and create an ErrorHandler:
 * ```typescript
 * private readonly errorHandler: ErrorHandler;
 *
 * constructor(
 *   @InjectPinoLogger(MyService.name) private readonly logger: PinoLogger,
 * ) {
 *   this.errorHandler = ErrorHandler.forService(MyService.name, logger);
 * }
 * ```
 *
 * 2. Use domain exceptions for business logic errors:
 * ```typescript
 * throw new EntityNotFoundException('User', userId);
 * throw new ValidationException({ email: ['Invalid format'] });
 * throw new BusinessRuleViolationException('Insufficient funds');
 * ```
 *
 * 3. Wrap operations with error handling:
 * ```typescript
 * return this.errorHandler.handleAsync(
 *   async () => {
 *     // Your operation here
 *   },
 *   { operation: 'operationName', userId }
 * );
 * ```
 *
 * 4. Use Result pattern for explicit error handling:
 * ```typescript
 * return this.errorHandler.handleResult(
 *   async () => {
 *     if (error) return Result.fail(new Error('Failed'));
 *     return Result.ok(value);
 *   },
 *   { operation: 'operationName' }
 * );
 * ```
 *
 * 5. Handle database operations with automatic error transformation:
 * ```typescript
 * await this.errorHandler.handleDatabase(
 *   async () => {
 *     // Database operation
 *   },
 *   'operationName',
 *   { userId }
 * );
 * ```
 *
 * 6. Document your API errors with Swagger:
 * ```typescript
 * @ApiResponse(ErrorResponseExamples.NotFound)
 * @ApiResponse(ErrorResponseExamples.ValidationError)
 * @ApiResponse(ErrorResponseExamples.InternalServerError)
 * ```
 */
