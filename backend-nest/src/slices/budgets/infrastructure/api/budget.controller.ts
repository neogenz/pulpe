import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
  ApiCreatedResponse,
  ApiQuery,
} from '@nestjs/swagger';
import {
  type BudgetListResponse,
  type BudgetResponse,
  type BudgetDeleteResponse,
  type BudgetDetailsResponse,
} from '@pulpe/shared';
import {
  User,
  SupabaseClient,
  type AuthenticatedUser,
} from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { ErrorResponseDto } from '@common/dto/response.dto';
import { LogOperation } from '@shared/infrastructure/logging/logging.decorators';
import { AuthRateLimit } from '@shared/infrastructure/security/throttler.decorators';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';

// Command and Query handlers
import { CreateBudgetHandler } from '../../application/handlers/create-budget.handler';
import { UpdateBudgetHandler } from '../../application/handlers/update-budget.handler';
import { DeleteBudgetHandler } from '../../application/handlers/delete-budget.handler';
import { GetBudgetHandler } from '../../application/handlers/get-budget.handler';
import { ListBudgetsHandler } from '../../application/handlers/list-budgets.handler';
import { GetBudgetByPeriodHandler } from '../../application/handlers/get-budget-by-period.handler';

// Commands and Queries
import { CreateBudgetCommand } from '../../application/commands/create-budget.command';
import { UpdateBudgetCommand } from '../../application/commands/update-budget.command';
import { DeleteBudgetCommand } from '../../application/commands/delete-budget.command';
import { GetBudgetQuery } from '../../application/queries/get-budget.query';
import { ListBudgetsQuery } from '../../application/queries/list-budgets.query';
import { GetBudgetByPeriodQuery } from '../../application/queries/get-budget-by-period.query';

// DTOs
import {
  BudgetCreateDto,
  BudgetUpdateDto,
  BudgetListResponseDto,
  BudgetResponseDto,
  BudgetDeleteResponseDto,
} from './dto/budget-swagger.dto';

// Mapper and Repository
import { BudgetMapper } from '../mappers/budget.mapper';
import { SupabaseBudgetRepository } from '../persistence/supabase-budget.repository';

@ApiTags('Budgets v2')
@ApiBearerAuth()
@Controller('v2/budgets')
@AuthRateLimit()
@ApiUnauthorizedResponse({
  description: 'Authentication required',
  type: ErrorResponseDto,
})
@ApiInternalServerErrorResponse({
  description: 'Internal server error',
  type: ErrorResponseDto,
})
export class BudgetController {
  constructor(
    private readonly createHandler: CreateBudgetHandler,
    private readonly updateHandler: UpdateBudgetHandler,
    private readonly deleteHandler: DeleteBudgetHandler,
    private readonly getHandler: GetBudgetHandler,
    private readonly listHandler: ListBudgetsHandler,
    private readonly getByPeriodHandler: GetBudgetByPeriodHandler,
    private readonly repository: SupabaseBudgetRepository,
    private readonly mapper: BudgetMapper,
  ) {}

  @Get()
  @LogOperation('ListBudgets')
  @ApiOperation({
    summary: 'List all user budgets',
    description:
      'Retrieves all budgets belonging to the authenticated user, ordered by year and month descending',
  })
  @ApiResponse({
    status: 200,
    description: 'Budget list retrieved successfully',
    type: BudgetListResponseDto,
  })
  async findAll(
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetListResponse> {
    // Set the authenticated client in the repository
    this.repository.setClient(supabase);

    const query = new ListBudgetsQuery(user.id);
    const result = await this.listHandler.execute(query);

    if (result.isFail()) {
      throw this.mapErrorToHttpException(result.error);
    }

    const apiData = this.mapper.snapshotListToApi(result.value);

    return {
      success: true,
      data: apiData,
    };
  }

  @Get('period')
  @LogOperation('GetBudgetByPeriod')
  @ApiOperation({
    summary: 'Get budget by period',
    description: 'Retrieves a budget for a specific month and year',
  })
  @ApiQuery({
    name: 'month',
    description: 'Month (1-12)',
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'year',
    description: 'Year',
    type: Number,
    example: 2024,
  })
  @ApiResponse({
    status: 200,
    description: 'Budget retrieved successfully',
    type: BudgetResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Budget not found for the specified period',
    type: ErrorResponseDto,
  })
  async findByPeriod(
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponse> {
    this.repository.setClient(supabase);

    const query = new GetBudgetByPeriodQuery(month, year, user.id);
    const result = await this.getByPeriodHandler.execute(query);

    if (result.isFail()) {
      throw this.mapErrorToHttpException(result.error);
    }

    if (!result.value) {
      throw new GenericDomainException(
        'Budget not found',
        'BUDGET_NOT_FOUND',
        `No budget found for period ${year}-${month.toString().padStart(2, '0')}`,
      );
    }

    const apiData = this.mapper.snapshotToApi(result.value);

    return {
      success: true,
      data: apiData,
    };
  }

  @Post()
  @LogOperation('CreateBudget')
  @ApiOperation({
    summary: 'Create a new budget',
    description:
      'Creates a new budget from an existing template using atomic transaction logic. Implements vertical slice architecture.',
  })
  @ApiCreatedResponse({
    description: 'Budget created successfully',
    type: BudgetResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  async create(
    @Body() createBudgetDto: BudgetCreateDto,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponse> {
    this.repository.setClient(supabase);

    const command = new CreateBudgetCommand(
      user.id,
      createBudgetDto.month,
      createBudgetDto.year,
      createBudgetDto.description,
      createBudgetDto.templateId,
    );

    const result = await this.createHandler.execute(command);

    if (result.isFail()) {
      throw this.mapErrorToHttpException(result.error);
    }

    const { budgetLinesCreated, ...budgetData } = result.value;

    return {
      success: true,
      data: {
        id: budgetData.id,
        userId: budgetData.userId,
        month: budgetData.month,
        year: budgetData.year,
        description: budgetData.description,
        templateId: budgetData.templateId,
        createdAt: budgetData.createdAt.toISOString(),
        updatedAt: budgetData.createdAt.toISOString(),
      },
    };
  }

  @Get(':id')
  @LogOperation('GetBudget')
  @ApiOperation({
    summary: 'Get budget by ID',
    description: 'Retrieves a specific budget by its unique identifier',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique budget identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Budget retrieved successfully',
    type: BudgetResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Budget not found',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponse> {
    this.repository.setClient(supabase);

    const query = new GetBudgetQuery(id, user.id);
    const result = await this.getHandler.execute(query);

    if (result.isFail()) {
      throw this.mapErrorToHttpException(result.error);
    }

    const apiData = this.mapper.snapshotToApi(result.value);

    return {
      success: true,
      data: apiData,
    };
  }

  @Patch(':id')
  @LogOperation('UpdateBudget')
  @ApiOperation({
    summary: 'Update existing budget',
    description: 'Partially updates an existing budget with new information',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique budget identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Budget updated successfully',
    type: BudgetResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Budget not found',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBudgetDto: BudgetUpdateDto,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponse> {
    this.repository.setClient(supabase);

    const command = new UpdateBudgetCommand(
      id,
      user.id,
      updateBudgetDto.description,
      updateBudgetDto.month,
      updateBudgetDto.year,
    );

    const result = await this.updateHandler.execute(command);

    if (result.isFail()) {
      throw this.mapErrorToHttpException(result.error);
    }

    const apiData = this.mapper.snapshotToApi(result.value);

    return {
      success: true,
      data: apiData,
    };
  }

  @Delete(':id')
  @LogOperation('DeleteBudget')
  @ApiOperation({
    summary: 'Delete existing budget',
    description:
      'Permanently deletes a budget and all associated data. Past budgets cannot be deleted.',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique budget identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Budget deleted successfully',
    type: BudgetDeleteResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Budget not found',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetDeleteResponse> {
    this.repository.setClient(supabase);

    const command = new DeleteBudgetCommand(id, user.id);
    const result = await this.deleteHandler.execute(command);

    if (result.isFail()) {
      throw this.mapErrorToHttpException(result.error);
    }

    return result.value;
  }

  /**
   * Map domain errors to appropriate HTTP exceptions
   */
  private mapErrorToHttpException(error: Error): Error {
    if (error instanceof DomainException) {
      // The global exception filter will handle DomainException appropriately
      return error;
    }

    // For other errors, wrap in a generic domain exception
    return new GenericDomainException(
      'Operation failed',
      'OPERATION_FAILED',
      error.message,
    );
  }
}
