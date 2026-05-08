import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { UpdateUserProfileInput } from './user.entity';

const MAX_NAME_LENGTH = 50;

export class UserInvariants {
  static validateProfileUpdate(input: UpdateUserProfileInput): void {
    const firstName = input.firstName?.trim();
    const lastName = input.lastName?.trim();

    if (!firstName) {
      throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING, {
        fields: ['firstName'],
      });
    }
    if (!lastName) {
      throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING, {
        fields: ['lastName'],
      });
    }
    if (firstName.length > MAX_NAME_LENGTH) {
      throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
        reason: `firstName must be at most ${MAX_NAME_LENGTH} characters`,
      });
    }
    if (lastName.length > MAX_NAME_LENGTH) {
      throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
        reason: `lastName must be at most ${MAX_NAME_LENGTH} characters`,
      });
    }
  }
}
