import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import {
  type BudgetListResponse,
  type BudgetResponse,
  type BudgetDeleteResponse,
  type BudgetDetailsResponse,
  type BudgetSparseListResponse,
  type ListBudgetsQuery,
} from 'pulpe-shared';
import { AuthGuard } from '@common/guards/auth.guard';
import {
  User,
  SupabaseClient,
  type AuthenticatedUser,
} from '@common/decorators/user.decorator';
import { BudgetService } from './budget.service';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  BudgetCreateDto,
  BudgetUpdateDto,
  BudgetResponseDto,
  BudgetDeleteResponseDto,
  BudgetDetailsResponseDto,
  ListBudgetsQueryDto,
  BudgetSparseListResponseDto,
} from './dto/budget-swagger.dto';
import { ErrorResponseDto } from '@common/dto/response.dto';

@ApiTags('Budgets')
@ApiBearerAuth()
@Controller({ path: 'budgets', version: '1' })
@UseGuards(AuthGuard)
@ApiUnauthorizedResponse({
  description: 'Authentication required',
  type: ErrorResponseDto,
})
@ApiInternalServerErrorResponse({
  description: 'Internal server error',
  type: ErrorResponseDto,
})
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Get()
  @ApiOperation({
    summary: 'List user budgets with optional sparse fieldsets',
    description:
      'Retrieves budgets with optional field selection, limit, and year filtering. Use sparse fieldsets to reduce payload size.',
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    description:
      'Comma-separated fields to return: month,year,totalExpenses,totalSavings,totalIncome,remaining,rollover',
    example: 'month,year,totalExpenses',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of budgets to return (1-36)',
    example: 3,
    type: Number,
  })
  @ApiQuery({
    name: 'year',
    required: false,
    description: 'Filter budgets by year',
    example: 2026,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Budget list retrieved successfully',
    type: BudgetSparseListResponseDto,
  })
  async findAll(
    @Query() query: ListBudgetsQueryDto,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetListResponse | BudgetSparseListResponse> {
    return this.budgetService.findAll(
      user,
      supabase,
      query as ListBudgetsQuery,
    );
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new budget',
    description:
      "Creates a new budget from an existing template using atomic transaction logic. Implements RG-006: Règle d'Instanciation Atomique (Template → Budget).",
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
    return this.budgetService.create(createBudgetDto, user, supabase);
  }

  @Get('export')
  @ApiOperation({
    summary: 'Export all budgets with full details',
    description:
      'Exports all budgets for the authenticated user with transactions, budget lines, and calculated values (rollover, remaining) as JSON',
  })
  @ApiResponse({
    status: 200,
    description: 'Export data retrieved successfully',
  })
  async exportAll(
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ) {
    return this.budgetService.exportAll(user, supabase);
  }

  @Get('exists')
  @ApiOperation({
    summary: 'Check if user has any budgets',
    description:
      'Lightweight endpoint that returns whether the authenticated user has at least one budget. Optimized for guard checks.',
  })
  @ApiResponse({
    status: 200,
    description: 'Budget existence check completed',
    schema: {
      type: 'object',
      properties: {
        hasBudget: { type: 'boolean' },
      },
    },
  })
  async checkBudgetExists(
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<{ hasBudget: boolean }> {
    const hasBudget = await this.budgetService.hasBudgets(user, supabase);
    return { hasBudget };
  }

  @Get(':id')
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
    return this.budgetService.findOne(id, user, supabase);
  }

  @Get(':id/details')
  @ApiOperation({
    summary: 'Get budget with all related data',
    description:
      'Retrieves a budget with its associated transactions and budget lines. This endpoint aggregates all related data in a single response for better performance.',
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
    description: 'Budget with details retrieved successfully',
    type: BudgetDetailsResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Budget not found',
    type: ErrorResponseDto,
  })
  async findOneWithDetails(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetDetailsResponse> {
    return this.budgetService.findOneWithDetails(id, user, supabase);
  }

  @Patch(':id')
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
    return this.budgetService.update(id, updateBudgetDto, user, supabase);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete existing budget',
    description: 'Permanently deletes a budget and all associated data',
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
    return this.budgetService.remove(id, user, supabase);
  }
}
