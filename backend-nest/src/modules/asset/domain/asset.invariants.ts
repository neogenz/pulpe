import type { AssetDirection } from 'pulpe-shared';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';

export class AssetInvariants {
  /**
   * A debt is valued by what remains due, so it is never negative. An `own`
   * asset may be negative: an overdrawn account counts on the debts side.
   */
  static validateValue(direction: AssetDirection, value: number): void {
    if (direction === 'owe' && value < 0) {
      throw new BusinessException(ERROR_DEFINITIONS.ASSET_VALUE_INVALID, {
        reason: 'the amount remaining due cannot be negative',
      });
    }
  }
}
