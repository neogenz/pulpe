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
import { createZodDto } from 'nestjs-zod';
import {
  budgetTemplateCreateSchema,
  budgetTemplateUpdateSchema,
  budgetTemplateListResponseSchema,
  budgetTemplateResponseSchema,
  budgetTemplateDeleteResponseSchema,
  templateTransactionListResponseSchema,
  type BudgetTemplateCreate,
  type BudgetTemplateUpdate,
  type BudgetTemplateListResponse,
  type BudgetTemplateResponse,
  type BudgetTemplateDeleteResponse,
  type TemplateTransactionListResponse,
} from '@pulpe/shared';
import { AuthGuard } from '@common/guards/auth.guard';
import { ZodBodyPipe } from '@common/pipes/zod-validation.pipe';
import {
  User,
  SupabaseClient,
  type AuthenticatedUser,
} from '@common/decorators/user.decorator';
import { BudgetTemplateService } from './budget-template.service';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { ErrorResponseDto } from '@common/dto/response.dto';

// Créer les DTOs automatiquement depuis les schémas Zod
class BudgetTemplateListResponseDto extends createZodDto(
  budgetTemplateListResponseSchema,
) {}
class BudgetTemplateResponseDto extends createZodDto(
  budgetTemplateResponseSchema,
) {}
class BudgetTemplateDeleteResponseDto extends createZodDto(
  budgetTemplateDeleteResponseSchema,
) {}
class TemplateTransactionListResponseDto extends createZodDto(
  templateTransactionListResponseSchema,
) {}

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
  ): Promise<BudgetTemplateListResponse> {
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
    @Body(new ZodBodyPipe(budgetTemplateCreateSchema))
    createTemplateDto: BudgetTemplateCreate,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateResponse> {
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
  ): Promise<BudgetTemplateResponse> {
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
    @Body(new ZodBodyPipe(budgetTemplateUpdateSchema))
    updateTemplateDto: BudgetTemplateUpdate,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateResponse> {
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
    type: TemplateTransactionListResponseDto,
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
  ): Promise<BudgetTemplateDeleteResponse> {
    return this.budgetTemplateService.remove(id, user, supabase);
  }
}
