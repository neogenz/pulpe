import { type Database, Tables } from '@/types/database.types';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  type TemplateLineCreateWithoutTemplateId,
  type TemplateLineDeleteResponse,
  type TemplateLineListResponse,
  type TemplateLineResponse,
  type TemplateLineUpdate,
  type TemplateLinesBulkUpdate,
  type TemplateLinesBulkUpdateResponse,
  templateLineCreateWithoutTemplateIdSchema,
  templateLineUpdateSchema,
  templateLinesBulkUpdateSchema,
} from '@pulpe/shared';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BudgetTemplateMapper } from '../budget-template.mapper';
import { TemplateValidationService } from './template-validation.service';

@Injectable()
export class TemplateLineService {
  constructor(
    @InjectPinoLogger(TemplateLineService.name)
    private readonly logger: PinoLogger,
    private readonly budgetTemplateMapper: BudgetTemplateMapper,
    private readonly templateValidationService: TemplateValidationService,
  ) {}

  /**
   * Get all template lines for a specific template
   * @param templateId - The template ID
   * @param user - The authenticated user
   * @param supabase - The authenticated Supabase client
   * @returns List of template lines
   */
  async findTemplateLines(
    templateId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineListResponse> {
    const startTime = Date.now();
    const operation = 'findTemplateLines';

    try {
      // Validate template access first
      await this.templateValidationService.validateTemplateAccess(
        templateId,
        user,
        supabase,
      );

      const { data: lines, error } = await supabase
        .from('template_line')
        .select('*')
        .eq('template_id', templateId)
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      const mappedLines = (lines || []).map((line) =>
        this.budgetTemplateMapper.toApiLine(line),
      );
      const response = {
        success: true as const,
        data: mappedLines,
      };

      this.logger.info({
        operation,
        templateId,
        userId: user.id,
        lineCount: response.data.length,
        duration: Date.now() - startTime,
        message: 'Template lines retrieved successfully',
      });

      return response;
    } catch (error) {
      this.logger.error({
        operation,
        templateId,
        userId: user.id,
        err: error,
        duration: Date.now() - startTime,
        message: 'Error retrieving template lines',
      });

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to retrieve template lines',
      );
    }
  }

  /**
   * Create a new template line
   * @param templateId - The template ID
   * @param createDto - The template line data
   * @param user - The authenticated user
   * @param supabase - The authenticated Supabase client
   * @returns The created template line
   */
  async createTemplateLine(
    templateId: string,
    createDto: TemplateLineCreateWithoutTemplateId,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineResponse> {
    const startTime = Date.now();
    const operation = 'createTemplateLine';

    try {
      // Validate template access first
      await this.templateValidationService.validateTemplateAccess(
        templateId,
        user,
        supabase,
      );

      // Validate input
      try {
        templateLineCreateWithoutTemplateIdSchema.parse(createDto);
      } catch (validationError) {
        this.logger.error({
          operation,
          templateId,
          userId: user.id,
          err: validationError,
          createDto,
          duration: Date.now() - startTime,
          message: 'Template line validation failed',
        });
        throw new BadRequestException('Invalid template line data');
      }

      // Convert to database format
      const dbData = this.budgetTemplateMapper.toInsertLine(
        createDto,
        templateId,
      );

      const { data: newLine, error } = await supabase
        .from('template_line')
        .insert(dbData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      const mappedLine = this.budgetTemplateMapper.toApiLine(newLine);
      const response: TemplateLineResponse = {
        success: true,
        data: mappedLine,
      };

      this.logger.info({
        operation,
        templateId,
        userId: user.id,
        lineId: response.data.id,
        duration: Date.now() - startTime,
        message: 'Template line created successfully',
      });

      return response;
    } catch (error) {
      this.logger.error({
        operation,
        templateId,
        userId: user.id,
        err: error,
        duration: Date.now() - startTime,
        message: 'Error creating template line',
      });

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to create template line');
    }
  }

  /**
   * Get a single template line
   * @param templateLineId - The template line ID
   * @param user - The authenticated user
   * @param supabase - The authenticated Supabase client
   * @returns The template line
   */
  async findTemplateLine(
    templateLineId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineResponse> {
    const startTime = Date.now();
    const operation = 'findTemplateLine';

    try {
      const { templateLine } =
        await this.templateValidationService.validateTemplateLineAccess(
          templateLineId,
          user,
          supabase,
        );

      const mappedLine = this.budgetTemplateMapper.toApiLine(templateLine);
      const response: TemplateLineResponse = {
        success: true,
        data: mappedLine,
      };

      this.logger.info({
        operation,
        templateLineId,
        userId: user.id,
        duration: Date.now() - startTime,
        message: 'Template line retrieved successfully',
      });

      return response;
    } catch (error) {
      this.logger.error({
        operation,
        templateLineId,
        userId: user.id,
        err: error,
        duration: Date.now() - startTime,
        message: 'Error retrieving template line',
      });

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to retrieve template line',
      );
    }
  }

  /**
   * Update a template line in the database
   * @param templateLineId - The template line ID
   * @param updateData - The validated update data
   * @param supabase - The authenticated Supabase client
   * @returns The updated template line
   */
  private async updateTemplateLineInDb(
    templateLineId: string,
    updateData: Partial<
      Database['public']['Tables']['template_line']['Update']
    >,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'template_line'>> {
    const { data, error } = await supabase
      .from('template_line')
      .update(updateData)
      .eq('id', templateLineId)
      .select()
      .single();

    if (error || !data) {
      throw error || new Error('Failed to update template line');
    }

    return data;
  }

  /**
   * Update a template line
   * @param templateLineId - The template line ID
   * @param updateDto - The update data
   * @param user - The authenticated user
   * @param supabase - The authenticated Supabase client
   * @returns The updated template line
   */
  async updateTemplateLine(
    templateLineId: string,
    updateDto: TemplateLineUpdate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineResponse> {
    const startTime = Date.now();
    const operation = 'updateTemplateLine';

    try {
      // Validate access - this will throw if user doesn't have access
      await this.templateValidationService.validateTemplateLineAccess(
        templateLineId,
        user,
        supabase,
      );

      // Validate input
      const validatedData = templateLineUpdateSchema.parse(updateDto);

      // Convert to database format
      const dbData = this.budgetTemplateMapper.toUpdateLine(validatedData);

      const updatedLine = await this.updateTemplateLineInDb(
        templateLineId,
        dbData,
        supabase,
      );

      const mappedLine = this.budgetTemplateMapper.toApiLine(updatedLine);
      const response: TemplateLineResponse = {
        success: true,
        data: mappedLine,
      };

      this.logger.info({
        operation,
        templateLineId,
        userId: user.id,
        duration: Date.now() - startTime,
        message: 'Template line updated successfully',
      });

      return response;
    } catch (error) {
      this.logger.error({
        operation,
        templateLineId,
        userId: user.id,
        err: error,
        duration: Date.now() - startTime,
        message: 'Error updating template line',
      });

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to update template line');
    }
  }

  /**
   * Bulk update template lines
   * @param templateId - The template ID
   * @param bulkUpdateDto - The bulk update data
   * @param user - The authenticated user
   * @param supabase - The authenticated Supabase client
   * @returns The updated template lines
   */
  async bulkUpdateTemplateLines(
    templateId: string,
    bulkUpdateDto: TemplateLinesBulkUpdate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLinesBulkUpdateResponse> {
    const startTime = Date.now();
    const operation = 'bulkUpdateTemplateLines';

    try {
      // Validate input
      const validatedData = templateLinesBulkUpdateSchema.parse(bulkUpdateDto);

      // Extract all line IDs
      const lineIds = validatedData.lines.map((update) => update.id);

      // Validate access to all lines
      await this.templateValidationService.validateTemplateLinesAccessBatch(
        lineIds,
        templateId,
        user,
        supabase,
      );

      // Process updates
      const updatedLines: Tables<'template_line'>[] = [];

      for (const update of validatedData.lines) {
        const dbData = this.budgetTemplateMapper.toUpdateLine(update);
        const updatedLine = await this.updateTemplateLineInDb(
          update.id,
          dbData,
          supabase,
        );
        updatedLines.push(updatedLine);
      }

      const mappedLines = updatedLines.map((line) =>
        this.budgetTemplateMapper.toApiLine(line),
      );
      const response: TemplateLinesBulkUpdateResponse = {
        success: true,
        data: mappedLines,
      };

      this.logger.info({
        operation,
        templateId,
        userId: user.id,
        updateCount: updatedLines.length,
        duration: Date.now() - startTime,
        message: 'Template lines bulk updated successfully',
      });

      return response;
    } catch (error) {
      this.logger.error({
        operation,
        templateId,
        userId: user.id,
        err: error,
        duration: Date.now() - startTime,
        message: 'Error bulk updating template lines',
      });

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to bulk update template lines',
      );
    }
  }

  /**
   * Delete a template line
   * @param templateLineId - The template line ID
   * @param user - The authenticated user
   * @param supabase - The authenticated Supabase client
   * @returns Success response
   */
  async deleteTemplateLine(
    templateLineId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineDeleteResponse> {
    const startTime = Date.now();
    const operation = 'deleteTemplateLine';

    try {
      await this.templateValidationService.validateTemplateLineAccess(
        templateLineId,
        user,
        supabase,
      );

      const { error } = await supabase
        .from('template_line')
        .delete()
        .eq('id', templateLineId);

      if (error) {
        throw error;
      }

      this.logger.info({
        operation,
        templateLineId,
        userId: user.id,
        duration: Date.now() - startTime,
        message: 'Template line deleted successfully',
      });

      return { success: true, message: 'Template line deleted successfully' };
    } catch (error) {
      this.logger.error({
        operation,
        templateLineId,
        userId: user.id,
        err: error,
        duration: Date.now() - startTime,
        message: 'Error deleting template line',
      });

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to delete template line');
    }
  }

  /**
   * Fetch and map template lines for a template
   * @param templateId - The template ID
   * @param supabase - The authenticated Supabase client
   * @returns Mapped template lines
   */
  async fetchAndMapTemplateLines(
    templateId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineResponse['data'][]> {
    const { data: lines, error } = await supabase
      .from('template_line')
      .select('*')
      .eq('template_id', templateId)
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return (lines || []).map((line) =>
      this.budgetTemplateMapper.toApiLine(line),
    );
  }
}
