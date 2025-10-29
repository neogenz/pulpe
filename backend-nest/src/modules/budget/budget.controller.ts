import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
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
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import {
  type BudgetListResponse,
  type BudgetResponse,
  type BudgetDeleteResponse,
  type BudgetDetailsResponse,
} from '@pulpe/shared';
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
  BudgetListResponseDto,
  BudgetResponseDto,
  BudgetDeleteResponseDto,
  BudgetDetailsResponseDto,
} from './dto/budget-swagger.dto';
import { ErrorResponseDto } from '@common/dto/response.dto';

@ApiTags('Budgets')
@ApiBearerAuth()
@Controller({ path: 'budgets', version: '1' })
@UseGuards(AuthGuard)
@SkipThrottle()
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
    summary: 'List all user budgets',
    description:
      'Retrieves all budgets belonging to the authenticated user, ordered by year and month',
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
    return this.budgetService.findAll(user, supabase);
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
