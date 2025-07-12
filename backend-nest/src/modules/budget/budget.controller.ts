import {
  Controller,
  Get,
  Post,
  Put,
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
import {
  type BudgetListResponse,
  type BudgetResponse,
  type BudgetDeleteResponse,
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
} from './dto/budget-swagger.dto';
import { ErrorResponseDto } from '@common/dto/response.dto';

@ApiTags('Budgets')
@ApiBearerAuth()
@Controller('budgets')
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
    return this.budgetService.findAll(supabase);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new budget',
    description: 'Creates a new budget for the authenticated user',
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
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponse> {
    return this.budgetService.findOne(id, supabase);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update existing budget',
    description: 'Updates an existing budget with new information',
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
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponse> {
    return this.budgetService.update(id, updateBudgetDto, supabase);
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
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetDeleteResponse> {
    return this.budgetService.remove(id, supabase);
  }
}
