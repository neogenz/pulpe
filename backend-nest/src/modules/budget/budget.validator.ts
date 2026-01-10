import { Injectable } from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { BudgetCreate, BudgetUpdate } from 'pulpe-shared';
import { BUDGET_CONSTANTS } from './budget.constants';

/**
 * Handles all validation logic for budgets
 */
@Injectable()
export class BudgetValidator {
  /**
   * Validates budget creation input data
   * @param createBudgetDto - Budget creation data
   * @returns Validated DTO
   */
  validateBudgetInput(createBudgetDto: BudgetCreate): BudgetCreate {
    this.validateRequiredFields(createBudgetDto);
    this.validateDateConstraints(createBudgetDto);
    this.validateBusinessRules(createBudgetDto);

    return createBudgetDto;
  }

  /**
   * Validates budget update input data
   * @param updateBudgetDto - Budget update data
   * @returns Validated DTO
   */
  validateUpdateBudgetDto(updateBudgetDto: BudgetUpdate): BudgetUpdate {
    // Validation for optional fields
    if (
      updateBudgetDto.month !== undefined &&
      (updateBudgetDto.month < BUDGET_CONSTANTS.MONTH_MIN ||
        updateBudgetDto.month > BUDGET_CONSTANTS.MONTH_MAX)
    ) {
      throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
        reason: `Month must be between ${BUDGET_CONSTANTS.MONTH_MIN} and ${BUDGET_CONSTANTS.MONTH_MAX}`,
      });
    }

    if (
      updateBudgetDto.year !== undefined &&
      (updateBudgetDto.year < BUDGET_CONSTANTS.MIN_YEAR ||
        updateBudgetDto.year > BUDGET_CONSTANTS.MAX_YEAR)
    ) {
      throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
        reason: `Year must be between ${BUDGET_CONSTANTS.MIN_YEAR} and ${BUDGET_CONSTANTS.MAX_YEAR}`,
      });
    }

    return updateBudgetDto;
  }

  /**
   * Validates that no duplicate budget exists for the same period
   * @param supabase - Authenticated Supabase client
   * @param month - Month to check
   * @param year - Year to check
   * @param excludeId - Budget ID to exclude from check (for updates)
   */
  async validateNoDuplicatePeriod(
    supabase: AuthenticatedSupabaseClient,
    month: number,
    year: number,
    excludeId?: string,
  ): Promise<void> {
    const { data: existingBudget } = await supabase
      .from('monthly_budget')
      .select('id')
      .eq('month', month)
      .eq('year', year)
      .neq('id', excludeId || '')
      .single();

    if (existingBudget) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_ALREADY_EXISTS_FOR_MONTH,
        { month, year },
      );
    }
  }

  /**
   * Validates required fields are present
   * @param createBudgetDto - Budget creation data
   */
  private validateRequiredFields(createBudgetDto: BudgetCreate): void {
    const missingFields = [];
    if (!createBudgetDto.month) missingFields.push('month');
    if (!createBudgetDto.year) missingFields.push('year');
    // Description is optional - no validation needed
    if (!createBudgetDto.templateId) missingFields.push('templateId');

    if (missingFields.length > 0) {
      throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING, {
        fields: missingFields,
      });
    }
  }

  /**
   * Validates date constraints (month, year ranges)
   * @param createBudgetDto - Budget creation data
   */
  private validateDateConstraints(createBudgetDto: BudgetCreate): void {
    // Month validation
    if (
      createBudgetDto.month < BUDGET_CONSTANTS.MONTH_MIN ||
      createBudgetDto.month > BUDGET_CONSTANTS.MONTH_MAX
    ) {
      throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
        reason: `Month must be between ${BUDGET_CONSTANTS.MONTH_MIN} and ${BUDGET_CONSTANTS.MONTH_MAX}`,
      });
    }

    // Year validation
    if (
      createBudgetDto.year < BUDGET_CONSTANTS.MIN_YEAR ||
      createBudgetDto.year > BUDGET_CONSTANTS.MAX_YEAR
    ) {
      throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
        reason: `Year must be between ${BUDGET_CONSTANTS.MIN_YEAR} and ${BUDGET_CONSTANTS.MAX_YEAR}`,
      });
    }
  }

  /**
   * Validates business rules (description length, future date limits)
   * @param createBudgetDto - Budget creation data
   */
  private validateBusinessRules(createBudgetDto: BudgetCreate): void {
    // Description length validation (only if description is provided)
    if (
      createBudgetDto.description &&
      createBudgetDto.description.length >
        BUDGET_CONSTANTS.DESCRIPTION_MAX_LENGTH
    ) {
      throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
        reason: `Description cannot exceed ${BUDGET_CONSTANTS.DESCRIPTION_MAX_LENGTH} characters`,
      });
    }

    // Future date validation (business rule: max 2 years ahead)
    const now = new Date();
    const budgetDate = new Date(
      createBudgetDto.year,
      createBudgetDto.month - 1,
    );
    const maxFutureDate = new Date(now.getFullYear() + 2, now.getMonth());

    if (budgetDate > maxFutureDate) {
      throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
        reason: 'Budget date cannot be more than 2 years in the future',
      });
    }
  }
}
