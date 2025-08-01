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
      const { data: template, error } = await supabase
        .from('template')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error || !template) {
        this.logger.warn({
          operation,
          templateId,
          userId: user.id,
          err: error,
          duration: Date.now() - startTime,
          message: 'Template not found',
        });
        throw new NotFoundException(`Template with ID ${templateId} not found`);
      }

      // Verify ownership - RLS should handle this, but double-check
      if (template.user_id !== user.id) {
        this.logger.warn({
          operation,
          templateId,
          userId: user.id,
          ownerId: template.user_id,
          duration: Date.now() - startTime,
          message: 'Unauthorized template access attempt',
        });
        throw new ForbiddenException('You do not have access to this template');
      }

      this.logger.debug({
        operation,
        templateId,
        userId: user.id,
        duration: Date.now() - startTime,
        message: 'Template access validated successfully',
      });

      return template;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.logger.error({
        operation,
        templateId,
        userId: user.id,
        err: error,
        duration: Date.now() - startTime,
        message: 'Error validating template access',
      });
      throw error;
    }
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
    const startTime = Date.now();
    const operation = 'validateTemplateLineAccess';

    try {
      const { data: templateLine, error } = await supabase
        .from('template_line')
        .select('*, template!inner(*)')
        .eq('id', templateLineId)
        .single();

      if (error || !templateLine) {
        this.logger.warn({
          operation,
          templateLineId,
          userId: user.id,
          err: error,
          duration: Date.now() - startTime,
          message: 'Template line not found',
        });
        throw new NotFoundException(
          `Template line with ID ${templateLineId} not found`,
        );
      }

      // Verify ownership through template
      if (templateLine.template.user_id !== user.id) {
        this.logger.warn({
          operation,
          templateLineId,
          userId: user.id,
          ownerId: templateLine.template.user_id,
          duration: Date.now() - startTime,
          message: 'Unauthorized template line access attempt',
        });
        throw new ForbiddenException(
          'You do not have access to this template line',
        );
      }

      return {
        templateLine,
        template: templateLine.template,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.logger.error({
        operation,
        templateLineId,
        userId: user.id,
        err: error,
        duration: Date.now() - startTime,
        message: 'Error validating template line access',
      });
      throw error;
    }
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
    const startTime = Date.now();
    const operation = 'validateTemplateLinesAccessBatch';

    try {
      // First validate the template access
      await this.validateTemplateAccess(templateId, user, supabase);

      // Then check all lines belong to this template
      const { data: lines, error } = await supabase
        .from('template_line')
        .select('id, template_id')
        .in('id', templateLineIds);

      if (error) {
        throw error;
      }

      const foundIds = new Set(lines?.map((l) => l.id) || []);
      const missingIds = templateLineIds.filter((id) => !foundIds.has(id));

      if (missingIds.length > 0) {
        this.logger.warn({
          operation,
          templateId,
          userId: user.id,
          missingIds,
          duration: Date.now() - startTime,
          message: 'Some template lines not found',
        });
        throw new NotFoundException(
          `Template lines not found: ${missingIds.join(', ')}`,
        );
      }

      // Verify all lines belong to the specified template
      const wrongTemplateLines =
        lines?.filter((l) => l.template_id !== templateId) || [];
      if (wrongTemplateLines.length > 0) {
        this.logger.warn({
          operation,
          templateId,
          userId: user.id,
          wrongLines: wrongTemplateLines.map((l) => l.id),
          duration: Date.now() - startTime,
          message: 'Some lines belong to different templates',
        });
        throw new BadRequestException(
          'All template lines must belong to the same template',
        );
      }

      this.logger.debug({
        operation,
        templateId,
        userId: user.id,
        lineCount: templateLineIds.length,
        duration: Date.now() - startTime,
        message: 'Batch template lines access validated successfully',
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error({
        operation,
        templateId,
        userId: user.id,
        err: error,
        duration: Date.now() - startTime,
        message: 'Error validating batch template lines access',
      });
      throw error;
    }
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
      // Check if user has created a template from onboarding in the last 24 hours
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

      if (recentTemplates && recentTemplates.length > 0) {
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

      this.logger.debug({
        operation,
        userId,
        duration: Date.now() - startTime,
        message: 'Onboarding rate limit check passed',
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error({
        operation,
        userId,
        err: error,
        duration: Date.now() - startTime,
        message: 'Error checking onboarding rate limit',
      });
      throw error;
    }
  }
}
