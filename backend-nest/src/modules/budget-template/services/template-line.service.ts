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
      await this.templateValidationService.validateTemplateAccess(
        templateId,
        user,
        supabase,
      );

      const lines = await this.fetchTemplateLinesFromDb(templateId, supabase);

      const response = this.buildTemplateLineListResponse(lines);

      this.logSuccessfulOperation(
        operation,
        templateId,
        user.id,
        response.data.length,
        startTime,
      );

      return response;
    } catch (error) {
      this.logOperationError(operation, templateId, user.id, error, startTime);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to retrieve template lines',
      );
    }
  }

  private async fetchTemplateLinesFromDb(
    templateId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'template_line'>[]> {
    const { data: lines, error } = await supabase
      .from('template_line')
      .select('*')
      .eq('template_id', templateId)
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return lines || [];
  }

  private buildTemplateLineListResponse(
    lines: Tables<'template_line'>[],
  ): TemplateLineListResponse {
    const mappedLines = lines.map((line) =>
      this.budgetTemplateMapper.toApiLine(line),
    );
    return {
      success: true as const,
      data: mappedLines,
    };
  }

  private logSuccessfulOperation(
    operation: string,
    templateId: string,
    userId: string,
    lineCount: number,
    startTime: number,
  ): void {
    this.logger.info({
      operation,
      templateId,
      userId,
      lineCount,
      duration: Date.now() - startTime,
      message: 'Template lines retrieved successfully',
    });
  }

  private logOperationError(
    operation: string,
    templateId: string,
    userId: string,
    error: unknown,
    startTime: number,
  ): void {
    this.logger.error({
      operation,
      templateId,
      userId,
      err: error,
      duration: Date.now() - startTime,
      message: 'Error retrieving template lines',
    });
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
    const ctx = this.initOperationContext('createTemplateLine');

    try {
      await this.templateValidationService.validateTemplateAccess(
        templateId,
        user,
        supabase,
      );

      this.validateCreateDto(createDto, ctx, templateId, user.id);

      const newLine = await this.insertTemplateLine(
        createDto,
        templateId,
        supabase,
      );

      const response = this.buildTemplateLineResponse(newLine);

      this.logLineCreated(ctx, templateId, user.id, response.data.id);

      return response;
    } catch (error) {
      this.logCreateError(ctx, templateId, user.id, error);
      this.reThrowKnownErrors(error);
      throw new InternalServerErrorException('Failed to create template line');
    }
  }

  private initOperationContext(operation: string) {
    return {
      operation,
      startTime: Date.now(),
    };
  }

  private reThrowKnownErrors(error: unknown): void {
    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestException
    ) {
      throw error;
    }
  }

  private validateCreateDto(
    createDto: TemplateLineCreateWithoutTemplateId,
    ctx: ReturnType<typeof this.initOperationContext>,
    templateId: string,
    userId: string,
  ): void {
    try {
      templateLineCreateWithoutTemplateIdSchema.parse(createDto);
    } catch (validationError) {
      this.logger.error({
        operation: ctx.operation,
        templateId,
        userId,
        err: validationError,
        createDto,
        duration: Date.now() - ctx.startTime,
        message: 'Template line validation failed',
      });
      throw new BadRequestException('Invalid template line data');
    }
  }

  private async insertTemplateLine(
    createDto: TemplateLineCreateWithoutTemplateId,
    templateId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'template_line'>> {
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

    return newLine;
  }

  private buildTemplateLineResponse(
    line: Tables<'template_line'>,
  ): TemplateLineResponse {
    const mappedLine = this.budgetTemplateMapper.toApiLine(line);
    return {
      success: true,
      data: mappedLine,
    };
  }

  private logLineCreated(
    ctx: ReturnType<typeof this.initOperationContext>,
    templateId: string,
    userId: string,
    lineId: string,
  ): void {
    this.logger.info({
      operation: ctx.operation,
      templateId,
      userId,
      lineId,
      duration: Date.now() - ctx.startTime,
      message: 'Template line created successfully',
    });
  }

  private logCreateError(
    ctx: ReturnType<typeof this.initOperationContext>,
    templateId: string,
    userId: string,
    error: unknown,
  ): void {
    this.logger.error({
      operation: ctx.operation,
      templateId,
      userId,
      err: error,
      duration: Date.now() - ctx.startTime,
      message: 'Error creating template line',
    });
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

      const response = this.buildTemplateLineResponse(templateLine);

      this.logRetrievalSuccess(operation, templateLineId, user.id, startTime);

      return response;
    } catch (error) {
      this.logRetrievalError(
        operation,
        templateLineId,
        user.id,
        error,
        startTime,
      );

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

  private logRetrievalSuccess(
    operation: string,
    templateLineId: string,
    userId: string,
    startTime: number,
  ): void {
    this.logger.info({
      operation,
      templateLineId,
      userId,
      duration: Date.now() - startTime,
      message: 'Template line retrieved successfully',
    });
  }

  private logRetrievalError(
    operation: string,
    templateLineId: string,
    userId: string,
    error: unknown,
    startTime: number,
  ): void {
    this.logger.error({
      operation,
      templateLineId,
      userId,
      err: error,
      duration: Date.now() - startTime,
      message: 'Error retrieving template line',
    });
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
      await this.templateValidationService.validateTemplateLineAccess(
        templateLineId,
        user,
        supabase,
      );

      const validatedData = this.validateUpdateDto(updateDto);
      const updatedLine = await this.performLineUpdate(
        templateLineId,
        validatedData,
        supabase,
      );

      const response = this.buildTemplateLineResponse(updatedLine);

      this.logUpdateSuccess(operation, templateLineId, user.id, startTime);

      return response;
    } catch (error) {
      this.logUpdateError(operation, templateLineId, user.id, error, startTime);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to update template line');
    }
  }

  private validateUpdateDto(updateDto: TemplateLineUpdate): TemplateLineUpdate {
    return templateLineUpdateSchema.parse(updateDto);
  }

  private async performLineUpdate(
    templateLineId: string,
    validatedData: TemplateLineUpdate,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'template_line'>> {
    const dbData = this.budgetTemplateMapper.toUpdateLine(validatedData);
    return this.updateTemplateLineInDb(templateLineId, dbData, supabase);
  }

  private logUpdateSuccess(
    operation: string,
    templateLineId: string,
    userId: string,
    startTime: number,
  ): void {
    this.logger.info({
      operation,
      templateLineId,
      userId,
      duration: Date.now() - startTime,
      message: 'Template line updated successfully',
    });
  }

  private logUpdateError(
    operation: string,
    templateLineId: string,
    userId: string,
    error: unknown,
    startTime: number,
  ): void {
    this.logger.error({
      operation,
      templateLineId,
      userId,
      err: error,
      duration: Date.now() - startTime,
      message: 'Error updating template line',
    });
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
      const validatedData = this.validateBulkUpdateDto(bulkUpdateDto);
      await this.validateBulkAccess(validatedData, templateId, user, supabase);

      const updatedLines = await this.performBulkUpdates(
        validatedData,
        supabase,
      );

      const response = this.buildBulkUpdateResponse(updatedLines);

      this.logBulkUpdateSuccess(
        operation,
        templateId,
        user.id,
        updatedLines.length,
        startTime,
      );

      return response;
    } catch (error) {
      this.logBulkUpdateError(operation, templateId, user.id, error, startTime);

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

  private validateBulkUpdateDto(
    bulkUpdateDto: TemplateLinesBulkUpdate,
  ): TemplateLinesBulkUpdate {
    return templateLinesBulkUpdateSchema.parse(bulkUpdateDto);
  }

  private async validateBulkAccess(
    validatedData: TemplateLinesBulkUpdate,
    templateId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const lineIds = validatedData.lines.map((update) => update.id);
    await this.templateValidationService.validateTemplateLinesAccessBatch(
      lineIds,
      templateId,
      user,
      supabase,
    );
  }

  private async performBulkUpdates(
    validatedData: TemplateLinesBulkUpdate,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'template_line'>[]> {
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

    return updatedLines;
  }

  private buildBulkUpdateResponse(
    updatedLines: Tables<'template_line'>[],
  ): TemplateLinesBulkUpdateResponse {
    const mappedLines = updatedLines.map((line) =>
      this.budgetTemplateMapper.toApiLine(line),
    );
    return {
      success: true,
      data: mappedLines,
    };
  }

  private logBulkUpdateSuccess(
    operation: string,
    templateId: string,
    userId: string,
    updateCount: number,
    startTime: number,
  ): void {
    this.logger.info({
      operation,
      templateId,
      userId,
      updateCount,
      duration: Date.now() - startTime,
      message: 'Template lines bulk updated successfully',
    });
  }

  private logBulkUpdateError(
    operation: string,
    templateId: string,
    userId: string,
    error: unknown,
    startTime: number,
  ): void {
    this.logger.error({
      operation,
      templateId,
      userId,
      err: error,
      duration: Date.now() - startTime,
      message: 'Error bulk updating template lines',
    });
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

      await this.performLineDelete(templateLineId, supabase);

      this.logDeleteSuccess(operation, templateLineId, user.id, startTime);

      return { success: true, message: 'Template line deleted successfully' };
    } catch (error) {
      this.logDeleteError(operation, templateLineId, user.id, error, startTime);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to delete template line');
    }
  }

  private async performLineDelete(
    templateLineId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const { error } = await supabase
      .from('template_line')
      .delete()
      .eq('id', templateLineId);

    if (error) {
      throw error;
    }
  }

  private logDeleteSuccess(
    operation: string,
    templateLineId: string,
    userId: string,
    startTime: number,
  ): void {
    this.logger.info({
      operation,
      templateLineId,
      userId,
      duration: Date.now() - startTime,
      message: 'Template line deleted successfully',
    });
  }

  private logDeleteError(
    operation: string,
    templateLineId: string,
    userId: string,
    error: unknown,
    startTime: number,
  ): void {
    this.logger.error({
      operation,
      templateLineId,
      userId,
      err: error,
      duration: Date.now() - startTime,
      message: 'Error deleting template line',
    });
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
