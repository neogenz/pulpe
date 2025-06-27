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
import {
  type BudgetTemplateListResponse as _BudgetTemplateListResponse,
  type BudgetTemplateResponse as _BudgetTemplateResponse,
  type BudgetTemplateDeleteResponse as _BudgetTemplateDeleteResponse,
  type TemplateTransactionListResponse,
} from '@pulpe/shared';
import { AuthGuard } from '@common/guards/auth.guard';
import {
  User,
  SupabaseClient,
  type AuthenticatedUser,
} from '@common/decorators/user.decorator';
import { BudgetTemplateService } from './budget-template.service';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  BudgetTemplateCreateDto,
  BudgetTemplateUpdateDto,
  BudgetTemplateListResponseDto,
  BudgetTemplateResponseDto,
  BudgetTemplateDeleteResponseDto,
} from './dto/budget-template-swagger.dto';
import { ErrorResponseDto } from '@common/dto/response.dto';

@ApiTags('Budget Templates')
@ApiBearerAuth()
@Controller('budget-templates')
@UseGuards(AuthGuard)
@ApiUnauthorizedResponse({
  description: 'Authentication required',
  type: ErrorResponseDto,
})
@ApiInternalServerErrorResponse({
  description: 'Internal server error',
  type: ErrorResponseDto,
})
export class BudgetTemplateController {
  constructor(private readonly budgetTemplateService: BudgetTemplateService) {}

  @Get()
  @ApiOperation({
    summary: 'List all budget templates',
    description:
      "Retrieves all budget templates accessible to the user (public templates + user's own templates)",
  })
  @ApiResponse({
    status: 200,
    description: 'Budget templates list retrieved successfully',
    type: BudgetTemplateListResponseDto,
  })
  async findAll(
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<_BudgetTemplateListResponse> {
    return this.budgetTemplateService.findAll(user, supabase);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new budget template',
    description: 'Creates a new budget template for the authenticated user',
  })
  @ApiCreatedResponse({
    description: 'Budget template created successfully',
    type: BudgetTemplateResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  async create(
    @Body() createTemplateDto: BudgetTemplateCreateDto,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<_BudgetTemplateResponse> {
    return this.budgetTemplateService.create(createTemplateDto, user, supabase);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get budget template by ID',
    description:
      'Retrieves a specific budget template by its unique identifier',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique budget template identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Budget template retrieved successfully',
    type: BudgetTemplateResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Budget template not found',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<_BudgetTemplateResponse> {
    return this.budgetTemplateService.findOne(id, user, supabase);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update existing budget template',
    description: 'Updates an existing budget template with new information',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique budget template identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Budget template updated successfully',
    type: BudgetTemplateResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Budget template not found',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTemplateDto: BudgetTemplateUpdateDto,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<_BudgetTemplateResponse> {
    return this.budgetTemplateService.update(
      id,
      updateTemplateDto,
      user,
      supabase,
    );
  }

  @Get(':id/transactions')
  @ApiOperation({
    summary: 'Get template transactions',
    description:
      'Retrieves all transactions associated with a specific budget template',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique budget template identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Template transactions retrieved successfully',
    type: Object, // TODO: Créer TemplateTransactionListResponseDto
  })
  @ApiNotFoundResponse({
    description: 'Budget template not found',
    type: ErrorResponseDto,
  })
  async findTemplateTransactions(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateTransactionListResponse> {
    return this.budgetTemplateService.findTemplateTransactions(
      id,
      user,
      supabase,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete existing budget template',
    description:
      'Permanently deletes a budget template and all associated data',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique budget template identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Budget template deleted successfully',
    type: BudgetTemplateDeleteResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Budget template not found',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<_BudgetTemplateDeleteResponse> {
    return this.budgetTemplateService.remove(id, user, supabase);
  }
}
