import { type Database, Tables } from '@/types/database.types';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  BadRequestException,
  Injectable,
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
import { BudgetTemplateMapper } from '../budget-template.mapper';
import { TemplateValidationService } from './template-validation.service';
import {
  LoggingService,
  type OperationContext,
} from '@common/services/logging.service';

@Injectable()
export class TemplateLineService {
  constructor(
    private readonly loggingService: LoggingService,
    private readonly budgetTemplateMapper: BudgetTemplateMapper,
    private readonly templateValidationService: TemplateValidationService,
  ) {
    // Set the logging context for this service instance
    this.loggingService.setContext(TemplateLineService.name);
  }

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
    const ctx = this.loggingService.initOperationContext('findTemplateLines');

    try {
      await this.templateValidationService.validateTemplateAccess(
        templateId,
        user,
        supabase,
      );

      const lines = await this.fetchTemplateLinesFromDb(templateId, supabase);

      const response = this.buildTemplateLineListResponse(lines);

      this.logSuccessWithContext(
        ctx,
        user.id,
        templateId,
        'Template lines retrieved successfully',
        { lineCount: response.data.length },
      );

      return response;
    } catch (error) {
      this.handleErrorWithContext(
        error,
        ctx,
        user.id,
        templateId,
        'Failed to retrieve template lines',
        [NotFoundException],
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
    const ctx = this.loggingService.initOperationContext('createTemplateLine');

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

      this.logSuccessWithContext(
        ctx,
        user.id,
        templateId,
        'Template line created successfully',
        { lineId: response.data.id },
      );

      return response;
    } catch (error) {
      this.handleErrorWithContext(
        error,
        ctx,
        user.id,
        templateId,
        'Failed to create template line',
        [NotFoundException, BadRequestException],
      );
    }
  }

  private logSuccessWithContext(
    ctx: OperationContext,
    userId: string,
    entityId: string,
    message: string,
    additionalContext?: Record<string, unknown>,
  ): void {
    this.loggingService.logOperationSuccess(
      ctx,
      userId,
      entityId,
      message,
      additionalContext,
    );
  }

  private handleErrorWithContext(
    error: unknown,
    ctx: OperationContext,
    userId: string,
    entityId: string,
    message: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    knownExceptions: Array<new (...args: any[]) => any> = [],
  ): never {
    this.loggingService.handleOperationError(
      error,
      ctx,
      userId,
      entityId,
      message,
      knownExceptions,
    );
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
    ctx: OperationContext,
    templateId: string,
    userId: string,
  ): void {
    try {
      templateLineCreateWithoutTemplateIdSchema.parse(createDto);
    } catch {
      this.loggingService.logError(
        this.loggingService.buildLogContext(
          ctx.operation,
          userId,
          templateId,
          ctx.startTime,
          {
            createDto,
          },
        ),
        'Template line validation failed',
      );
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
    const ctx = this.loggingService.initOperationContext('findTemplateLine');

    try {
      const { templateLine } =
        await this.templateValidationService.validateTemplateLineAccess(
          templateLineId,
          user,
          supabase,
        );

      const response = this.buildTemplateLineResponse(templateLine);

      this.logSuccessWithContext(
        ctx,
        user.id,
        templateLineId,
        'Template line retrieved successfully',
      );

      return response;
    } catch (error) {
      this.handleErrorWithContext(
        error,
        ctx,
        user.id,
        templateLineId,
        'Failed to retrieve template line',
        [NotFoundException, BadRequestException],
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
    const ctx = this.loggingService.initOperationContext('updateTemplateLine');

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

      this.logSuccessWithContext(
        ctx,
        user.id,
        templateLineId,
        'Template line updated successfully',
      );

      return response;
    } catch (error) {
      this.handleErrorWithContext(
        error,
        ctx,
        user.id,
        templateLineId,
        'Failed to update template line',
        [NotFoundException, BadRequestException],
      );
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
    const ctx = this.loggingService.initOperationContext(
      'bulkUpdateTemplateLines',
    );

    try {
      const validatedData = this.validateBulkUpdateDto(bulkUpdateDto);
      await this.validateBulkAccess(validatedData, templateId, user, supabase);

      const updatedLines = await this.performBulkUpdates(
        validatedData,
        supabase,
      );

      const response = this.buildBulkUpdateResponse(updatedLines);

      this.logSuccessWithContext(
        ctx,
        user.id,
        templateId,
        'Template lines bulk updated successfully',
        { updateCount: updatedLines.length },
      );

      return response;
    } catch (error) {
      this.handleErrorWithContext(
        error,
        ctx,
        user.id,
        templateId,
        'Failed to bulk update template lines',
        [NotFoundException, BadRequestException],
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
    const updateBatches = this.groupUpdatesByProperties(validatedData);
    const batchResults = await this.executeBatchUpdates(
      updateBatches,
      supabase,
    );
    return this.orderResultsByInput(validatedData.lines, batchResults);
  }

  private groupUpdatesByProperties(validatedData: TemplateLinesBulkUpdate): Map<
    string,
    {
      ids: string[];
      data: Partial<Database['public']['Tables']['template_line']['Update']>;
    }
  > {
    const updateBatches = new Map<
      string,
      {
        ids: string[];
        data: Partial<Database['public']['Tables']['template_line']['Update']>;
      }
    >();

    for (const update of validatedData.lines) {
      const dbData = this.budgetTemplateMapper.toUpdateLine(update);
      const updateKey = JSON.stringify(dbData);

      if (!updateBatches.has(updateKey)) {
        updateBatches.set(updateKey, { ids: [], data: dbData });
      }
      const batchEntry = updateBatches.get(updateKey);
      if (batchEntry) {
        batchEntry.ids.push(update.id);
      }
    }

    return updateBatches;
  }

  private async executeBatchUpdates(
    updateBatches: Map<
      string,
      {
        ids: string[];
        data: Partial<Database['public']['Tables']['template_line']['Update']>;
      }
    >,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'template_line'>[][]> {
    const updatePromises: Promise<Tables<'template_line'>[]>[] = [];

    for (const [, batch] of updateBatches) {
      const promise = supabase
        .from('template_line')
        .update(batch.data)
        .in('id', batch.ids)
        .select()
        .then(({ data, error }) => {
          if (error) throw error;
          return data || [];
        }) as Promise<Tables<'template_line'>[]>;
      updatePromises.push(promise);
    }

    return Promise.all(updatePromises);
  }

  private orderResultsByInput(
    inputLines: TemplateLinesBulkUpdate['lines'],
    batchResults: Tables<'template_line'>[][],
  ): Tables<'template_line'>[] {
    const allUpdatedLines = batchResults.flat();
    const lineIdToUpdated = new Map(
      allUpdatedLines.map((line) => [line.id, line]),
    );

    return inputLines
      .map((update) => lineIdToUpdated.get(update.id))
      .filter((line): line is Tables<'template_line'> => line !== undefined);
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
    const ctx = this.loggingService.initOperationContext('deleteTemplateLine');

    try {
      await this.templateValidationService.validateTemplateLineAccess(
        templateLineId,
        user,
        supabase,
      );

      await this.performLineDelete(templateLineId, supabase);

      this.logSuccessWithContext(
        ctx,
        user.id,
        templateLineId,
        'Template line deleted successfully',
      );

      return { success: true, message: 'Template line deleted successfully' };
    } catch (error) {
      this.handleErrorWithContext(
        error,
        ctx,
        user.id,
        templateLineId,
        'Failed to delete template line',
        [NotFoundException, BadRequestException],
      );
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
