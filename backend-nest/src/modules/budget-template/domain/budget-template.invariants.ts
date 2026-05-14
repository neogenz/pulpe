import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';

const MAX_TEMPLATES_PER_USER = 5;

export class BudgetTemplateInvariants {
  static validateTemplateLimit(count: number): void {
    if (count >= MAX_TEMPLATES_PER_USER) {
      throw new BusinessException(ERROR_DEFINITIONS.TEMPLATE_LIMIT_EXCEEDED, {
        limit: MAX_TEMPLATES_PER_USER,
      });
    }
  }

  static validateTemplateNotUsed(
    templateId: string,
    budgetCount: number,
  ): void {
    if (budgetCount > 0) {
      throw new BusinessException(ERROR_DEFINITIONS.TEMPLATE_IN_USE, {
        id: templateId,
      });
    }
  }
}
