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
import { Throttle } from '@nestjs/throttler';
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
  type BudgetTemplateCreateResponse as _BudgetTemplateCreateResponse,
  type BudgetTemplateDeleteResponse as _BudgetTemplateDeleteResponse,
  type TemplateLineListResponse,
  type TemplateLineResponse as _TemplateLineResponse,
  type TemplateLineDeleteResponse as _TemplateLineDeleteResponse,
  type TemplateLinesBulkUpdateResponse as _TemplateLinesBulkUpdateResponse,
  type TemplateLinesBulkOperationsResponse as _TemplateLinesBulkOperationsResponse,
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
  BudgetTemplateCreateFromOnboardingDto,
  BudgetTemplateUpdateDto,
  BudgetTemplateListResponseDto,
  BudgetTemplateResponseDto,
  BudgetTemplateCreateResponseDto,
  BudgetTemplateDeleteResponseDto,
  TemplateLineCreateDto,
  TemplateLineUpdateDto,
  TemplateLineListResponseDto,
  TemplateLineResponseDto,
  TemplateLineDeleteResponseDto,
  TemplateLinesBulkUpdateDto,
  TemplateLinesBulkUpdateResponseDto,
  TemplateLinesBulkOperationsDto,
  TemplateLinesBulkOperationsResponseDto,
} from './dto/budget-template-swagger.dto';
import { ErrorResponseDto } from '@common/dto/response.dto';

@ApiTags('Budget Templates')
@ApiBearerAuth()
@Controller({ path: 'budget-templates', version: '1' })
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
    type: BudgetTemplateCreateResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  async create(
    @Body() createTemplateDto: BudgetTemplateCreateDto,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<_BudgetTemplateCreateResponse> {
    return this.budgetTemplateService.create(createTemplateDto, user, supabase);
  }

  @Post('from-onboarding')
  @ApiOperation({
    summary: 'Create budget template from onboarding data',
    description:
      'Creates a new budget template based on user onboarding data including income and fixed expenses',
  })
  @ApiCreatedResponse({
    description: 'Budget template created successfully from onboarding data',
    type: BudgetTemplateCreateResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid onboarding data',
    type: ErrorResponseDto,
  })
  async createFromOnboarding(
    @Body() onboardingData: BudgetTemplateCreateFromOnboardingDto,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<_BudgetTemplateCreateResponse> {
    return this.budgetTemplateService.createFromOnboarding(
      onboardingData,
      user,
      supabase,
    );
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

  @Get(':id/lines')
  @ApiOperation({
    summary: 'Get template lines',
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
    description: 'Template lines retrieved successfully',
    type: TemplateLineListResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Budget template not found',
    type: ErrorResponseDto,
  })
  async findTemplateLines(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineListResponse> {
    return this.budgetTemplateService.findTemplateLines(id, user, supabase);
  }

  @Patch(':id/lines')
  @ApiOperation({
    summary: 'Bulk update template lines',
    description:
      'Updates multiple template lines for a specific budget template in a single transaction',
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
    description: 'Template lines updated successfully',
    type: TemplateLinesBulkUpdateResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Budget template not found',
    type: ErrorResponseDto,
  })
  async bulkUpdateTemplateLines(
    @Param('id', ParseUUIDPipe) templateId: string,
    @Body() bulkUpdateDto: TemplateLinesBulkUpdateDto,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<_TemplateLinesBulkUpdateResponse> {
    return this.budgetTemplateService.bulkUpdateTemplateLines(
      templateId,
      bulkUpdateDto,
      user,
      supabase,
    );
  }

  @Post(':id/lines/bulk-operations')
  @ApiOperation({
    summary: 'Bulk operations on template lines',
    description:
      'Performs bulk operations (create, update, delete) on template lines for a specific budget template',
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
    description: 'Bulk operations completed successfully',
    type: TemplateLinesBulkOperationsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Budget template not found',
    type: ErrorResponseDto,
  })
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute for bulk operations
  async bulkOperationsTemplateLines(
    @Param('id', ParseUUIDPipe) templateId: string,
    @Body() bulkOperationsDto: TemplateLinesBulkOperationsDto,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<_TemplateLinesBulkOperationsResponse> {
    return this.budgetTemplateService.bulkOperationsTemplateLines(
      templateId,
      bulkOperationsDto,
      user,
      supabase,
    );
  }

  @Post(':id/lines')
  @ApiOperation({
    summary: 'Create a new template line',
    description: 'Creates a new template line for a specific budget template',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique budget template identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: 'string',
    format: 'uuid',
  })
  @ApiCreatedResponse({
    description: 'Template line created successfully',
    type: TemplateLineResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Budget template not found',
    type: ErrorResponseDto,
  })
  async createTemplateLine(
    @Param('id', ParseUUIDPipe) templateId: string,
    @Body() createLineDto: TemplateLineCreateDto,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<_TemplateLineResponse> {
    return this.budgetTemplateService.createTemplateLine(
      templateId,
      createLineDto,
      user,
      supabase,
    );
  }

  @Get(':templateId/lines/:lineId')
  @ApiOperation({
    summary: 'Get template line by ID',
    description: 'Retrieves a specific template line by its unique identifier',
  })
  @ApiParam({
    name: 'templateId',
    description: 'Unique budget template identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: 'string',
    format: 'uuid',
  })
  @ApiParam({
    name: 'lineId',
    description: 'Unique template line identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Template line retrieved successfully',
    type: TemplateLineResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Template line not found',
    type: ErrorResponseDto,
  })
  async findTemplateLine(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<_TemplateLineResponse> {
    return this.budgetTemplateService.findTemplateLine(lineId, user, supabase);
  }

  @Patch(':templateId/lines/:lineId')
  @ApiOperation({
    summary: 'Update template line',
    description: 'Updates an existing template line with new information',
  })
  @ApiParam({
    name: 'templateId',
    description: 'Unique budget template identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: 'string',
    format: 'uuid',
  })
  @ApiParam({
    name: 'lineId',
    description: 'Unique template line identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Template line updated successfully',
    type: TemplateLineResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Template line not found',
    type: ErrorResponseDto,
  })
  async updateTemplateLine(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() updateLineDto: TemplateLineUpdateDto,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<_TemplateLineResponse> {
    return this.budgetTemplateService.updateTemplateLine(
      lineId,
      updateLineDto,
      user,
      supabase,
    );
  }

  @Delete(':templateId/lines/:lineId')
  @ApiOperation({
    summary: 'Delete template line',
    description: 'Permanently deletes a template line',
  })
  @ApiParam({
    name: 'templateId',
    description: 'Unique budget template identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: 'string',
    format: 'uuid',
  })
  @ApiParam({
    name: 'lineId',
    description: 'Unique template line identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Template line deleted successfully',
    type: TemplateLineDeleteResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Template line not found',
    type: ErrorResponseDto,
  })
  async deleteTemplateLine(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ): Promise<_TemplateLineDeleteResponse> {
    return this.budgetTemplateService.deleteTemplateLine(
      lineId,
      user,
      supabase,
    );
  }

  @Get(':id/usage')
  @ApiOperation({
    summary: 'Check template usage in budgets',
    description:
      'Checks if a budget template is being used in any monthly budgets and returns the list',
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
    description: 'Template usage information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            isUsed: { type: 'boolean' },
            budgetCount: { type: 'number' },
            budgets: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  month: { type: 'number' },
                  year: { type: 'number' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Budget template not found',
    type: ErrorResponseDto,
  })
  async checkUsage(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: AuthenticatedUser,
    @SupabaseClient() supabase: AuthenticatedSupabaseClient,
  ) {
    return this.budgetTemplateService.checkTemplateUsage(id, user, supabase);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete existing budget template',
    description:
      'Permanently deletes a budget template and all associated data. Will fail if template is used in any budgets.',
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
  @ApiBadRequestResponse({
    description: 'Template is being used in one or more budgets',
    type: ErrorResponseDto,
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
