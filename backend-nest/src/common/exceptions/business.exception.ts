import { HttpException } from '@nestjs/common';
import { ErrorDefinition } from '@common/constants/error-definitions';

/**
 * Business exception that uses centralized error definitions
 */
export class BusinessException extends HttpException {
  constructor(errorDefinition: ErrorDefinition) {
    super(errorDefinition.message, errorDefinition.httpStatus);
  }
}
