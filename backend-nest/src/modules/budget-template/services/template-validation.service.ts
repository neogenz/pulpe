import { Tables } from '@/types/database.types';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

type TemplateLineWithTemplate = Tables<'template_line'> & {
  template: Tables<'template'>;
};

@Injectable()
export class TemplateValidationService {
  constructor(
    @InjectPinoLogger(TemplateValidationService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Validates template access for the authenticated user
   * All templates are user-owned, no public templates exist
   * @param templateId - The template ID to validate
   * @param user - The authenticated user
   * @param supabase - The authenticated Supabase client
   */
  async validateTemplateAccess(
    templateId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'template'>> {
    const startTime = Date.now();
    const operation = 'validateTemplateAccess';

    try {
      const template = await this.fetchTemplate(templateId, supabase);

      this.checkTemplateExists(
        template,
        templateId,
        operation,
        user.id,
        startTime,
      );

      this.checkTemplateOwnership(
        template!,
        user.id,
        operation,
        templateId,
        startTime,
      );

      this.logSuccessfulValidation(operation, templateId, user.id, startTime);

      return template!;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.logValidationError(operation, templateId, user.id, error, startTime);
      throw error;
    }
  }

  private async fetchTemplate(
    templateId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'template'> | null> {
    const { data: template, error } = await supabase
      .from('template')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) {
      return null;
    }

    return template;
  }

  private checkTemplateExists(
    template: Tables<'template'> | null,
    templateId: string,
    operation: string,
    userId: string,
    startTime: number,
  ): asserts template is Tables<'template'> {
    if (!template) {
      this.logger.warn({
        operation,
        templateId,
        userId,
        duration: Date.now() - startTime,
        message: 'Template not found',
      });
      throw new NotFoundException(`Template with ID ${templateId} not found`);
    }
  }

  private checkTemplateOwnership(
    template: Tables<'template'>,
    userId: string,
    operation: string,
    templateId: string,
    startTime: number,
  ): void {
    if (template.user_id !== userId) {
      this.logger.warn({
        operation,
        templateId,
        userId,
        ownerId: template.user_id,
        duration: Date.now() - startTime,
        message: 'Unauthorized template access attempt',
      });
      throw new ForbiddenException('You do not have access to this template');
    }
  }

  private logSuccessfulValidation(
    operation: string,
    templateId: string,
    userId: string,
    startTime: number,
  ): void {
    this.logger.debug({
      operation,
      templateId,
      userId,
      duration: Date.now() - startTime,
      message: 'Template access validated successfully',
    });
  }

  private logValidationError(
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
      message: 'Error validating template access',
    });
  }

  /**
   * Validates template line access for the authenticated user
   * @param templateLineId - The template line ID to validate
   * @param user - The authenticated user
   * @param supabase - The authenticated Supabase client
   * @returns The template line and its associated template
   */
  async validateTemplateLineAccess(
    templateLineId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<{
    templateLine: Tables<'template_line'>;
    template: Tables<'template'>;
  }> {
    const ctx = this.createValidationContext('validateTemplateLineAccess');

    try {
      const lineWithTemplate = await this.fetchTemplateLineWithTemplate(
        templateLineId,
        supabase,
      );

      this.validateLineExistsAndOwned(
        lineWithTemplate,
        templateLineId,
        user.id,
        ctx,
      );

      return {
        templateLine: lineWithTemplate!,
        template: lineWithTemplate!.template,
      };
    } catch (error) {
      this.handleValidationError(error, () =>
        this.logLineValidationError(
          ctx.operation,
          templateLineId,
          user.id,
          error,
          ctx.startTime,
        ),
      );
    }
  }

  private createValidationContext(operation: string) {
    return {
      operation,
      startTime: Date.now(),
    };
  }

  private validateLineExistsAndOwned(
    lineWithTemplate: TemplateLineWithTemplate | null,
    templateLineId: string,
    userId: string,
    ctx: ReturnType<typeof this.createValidationContext>,
  ): asserts lineWithTemplate is TemplateLineWithTemplate {
    this.checkTemplateLineExists(
      lineWithTemplate,
      templateLineId,
      ctx.operation,
      userId,
      ctx.startTime,
    );

    this.checkTemplateLineOwnership(
      lineWithTemplate,
      userId,
      ctx.operation,
      templateLineId,
      ctx.startTime,
    );
  }

  private handleValidationError(error: unknown, logError: () => void): never {
    if (
      error instanceof NotFoundException ||
      error instanceof ForbiddenException
    ) {
      throw error;
    }

    logError();
    throw error;
  }

  private async fetchTemplateLineWithTemplate(
    templateLineId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineWithTemplate | null> {
    const { data: templateLine, error } = await supabase
      .from('template_line')
      .select('*, template!inner(*)')
      .eq('id', templateLineId)
      .single();

    if (error) {
      return null;
    }

    return templateLine as unknown as TemplateLineWithTemplate;
  }

  private checkTemplateLineExists(
    lineWithTemplate: TemplateLineWithTemplate | null,
    templateLineId: string,
    operation: string,
    userId: string,
    startTime: number,
  ): asserts lineWithTemplate is TemplateLineWithTemplate {
    if (!lineWithTemplate) {
      this.logger.warn({
        operation,
        templateLineId,
        userId,
        duration: Date.now() - startTime,
        message: 'Template line not found',
      });
      throw new NotFoundException(
        `Template line with ID ${templateLineId} not found`,
      );
    }
  }

  private checkTemplateLineOwnership(
    lineWithTemplate: TemplateLineWithTemplate,
    userId: string,
    operation: string,
    templateLineId: string,
    startTime: number,
  ): void {
    if (lineWithTemplate.template.user_id !== userId) {
      this.logger.warn({
        operation,
        templateLineId,
        userId,
        ownerId: lineWithTemplate.template.user_id,
        duration: Date.now() - startTime,
        message: 'Unauthorized template line access attempt',
      });
      throw new ForbiddenException(
        'You do not have access to this template line',
      );
    }
  }

  private logLineValidationError(
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
      message: 'Error validating template line access',
    });
  }

  /**
   * Validates access to multiple template lines in batch
   * @param templateLineIds - Array of template line IDs to validate
   * @param templateId - The template ID these lines should belong to
   * @param user - The authenticated user
   * @param supabase - The authenticated Supabase client
   */
  async validateTemplateLinesAccessBatch(
    templateLineIds: string[],
    templateId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const ctx = this.createValidationContext(
      'validateTemplateLinesAccessBatch',
    );

    try {
      await this.performBatchValidation(
        templateLineIds,
        templateId,
        user,
        supabase,
        ctx,
      );
    } catch (error) {
      this.handleBatchValidationError(error, templateId, user.id, ctx);
    }
  }

  private async performBatchValidation(
    templateLineIds: string[],
    templateId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
    ctx: ReturnType<typeof this.createValidationContext>,
  ): Promise<void> {
    await this.validateTemplateAccess(templateId, user, supabase);

    const lines = await this.fetchTemplateLines(templateLineIds, supabase);

    this.validateAllLinesExistAndBelongToTemplate(
      lines,
      templateLineIds,
      templateId,
      user.id,
      ctx,
    );

    this.logBatchValidationSuccess(
      ctx.operation,
      templateId,
      user.id,
      templateLineIds.length,
      ctx.startTime,
    );
  }

  private validateAllLinesExistAndBelongToTemplate(
    lines: Pick<Tables<'template_line'>, 'id' | 'template_id'>[],
    templateLineIds: string[],
    templateId: string,
    userId: string,
    ctx: ReturnType<typeof this.createValidationContext>,
  ): void {
    this.checkAllLinesExist(
      lines,
      templateLineIds,
      ctx.operation,
      templateId,
      userId,
      ctx.startTime,
    );

    this.checkAllLinesBelongToTemplate(
      lines,
      templateId,
      ctx.operation,
      userId,
      ctx.startTime,
    );
  }

  private handleBatchValidationError(
    error: unknown,
    templateId: string,
    userId: string,
    ctx: ReturnType<typeof this.createValidationContext>,
  ): never {
    if (
      error instanceof NotFoundException ||
      error instanceof ForbiddenException ||
      error instanceof BadRequestException
    ) {
      throw error;
    }

    this.logBatchValidationError(
      ctx.operation,
      templateId,
      userId,
      error,
      ctx.startTime,
    );
    throw error;
  }

  private async fetchTemplateLines(
    templateLineIds: string[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Pick<Tables<'template_line'>, 'id' | 'template_id'>[]> {
    const { data: lines, error } = await supabase
      .from('template_line')
      .select('id, template_id')
      .in('id', templateLineIds);

    if (error) {
      throw error;
    }

    return lines || [];
  }

  private checkAllLinesExist(
    lines: Pick<Tables<'template_line'>, 'id' | 'template_id'>[],
    templateLineIds: string[],
    operation: string,
    templateId: string,
    userId: string,
    startTime: number,
  ): void {
    const foundIds = new Set(lines.map((l) => l.id));
    const missingIds = templateLineIds.filter((id) => !foundIds.has(id));

    if (missingIds.length > 0) {
      this.logger.warn({
        operation,
        templateId,
        userId,
        missingIds,
        duration: Date.now() - startTime,
        message: 'Some template lines not found',
      });
      throw new NotFoundException(
        `Template lines not found: ${missingIds.join(', ')}`,
      );
    }
  }

  private checkAllLinesBelongToTemplate(
    lines: Pick<Tables<'template_line'>, 'id' | 'template_id'>[],
    templateId: string,
    operation: string,
    userId: string,
    startTime: number,
  ): void {
    const wrongTemplateLines = lines.filter(
      (l) => l.template_id !== templateId,
    );

    if (wrongTemplateLines.length > 0) {
      this.logger.warn({
        operation,
        templateId,
        userId,
        wrongLines: wrongTemplateLines.map((l) => l.id),
        duration: Date.now() - startTime,
        message: 'Some lines belong to different templates',
      });
      throw new BadRequestException(
        'All template lines must belong to the same template',
      );
    }
  }

  private logBatchValidationSuccess(
    operation: string,
    templateId: string,
    userId: string,
    lineCount: number,
    startTime: number,
  ): void {
    this.logger.debug({
      operation,
      templateId,
      userId,
      lineCount,
      duration: Date.now() - startTime,
      message: 'Batch template lines access validated successfully',
    });
  }

  private logBatchValidationError(
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
      message: 'Error validating batch template lines access',
    });
  }

  /**
   * Check if user has created a template from onboarding recently
   * Implements rate limiting to prevent abuse
   * @param userId - The user ID to check
   * @param supabase - The authenticated Supabase client
   */
  async checkOnboardingRateLimit(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const startTime = Date.now();
    const operation = 'checkOnboardingRateLimit';

    try {
      const recentTemplates = await this.fetchRecentOnboardingTemplates(
        userId,
        supabase,
      );

      this.validateRateLimit(recentTemplates, operation, userId, startTime);

      this.logRateLimitPassed(operation, userId, startTime);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logRateLimitError(operation, userId, error, startTime);
      throw error;
    }
  }

  private async fetchRecentOnboardingTemplates(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Pick<Tables<'template'>, 'id' | 'created_at'>[]> {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: recentTemplates, error } = await supabase
      .from('template')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('is_from_onboarding', true)
      .gte('created_at', twentyFourHoursAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return recentTemplates || [];
  }

  private validateRateLimit(
    recentTemplates: Pick<Tables<'template'>, 'id' | 'created_at'>[],
    operation: string,
    userId: string,
    startTime: number,
  ): void {
    if (recentTemplates.length > 0) {
      this.logger.warn({
        operation,
        userId,
        recentCount: recentTemplates.length,
        lastCreated: recentTemplates[0].created_at,
        duration: Date.now() - startTime,
        message: 'User exceeded onboarding template creation rate limit',
      });
      throw new BadRequestException(
        'You can only create one template from onboarding per 24 hours',
      );
    }
  }

  private logRateLimitPassed(
    operation: string,
    userId: string,
    startTime: number,
  ): void {
    this.logger.debug({
      operation,
      userId,
      duration: Date.now() - startTime,
      message: 'Onboarding rate limit check passed',
    });
  }

  private logRateLimitError(
    operation: string,
    userId: string,
    error: unknown,
    startTime: number,
  ): void {
    this.logger.error({
      operation,
      userId,
      err: error,
      duration: Date.now() - startTime,
      message: 'Error checking onboarding rate limit',
    });
  }
}
