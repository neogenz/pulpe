import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { SupabaseClient } from '@supabase/supabase-js';
import { Result } from '@shared/domain/enhanced-result';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import { Database } from '@/types/database.types';
import { BudgetTemplateRepository } from '../../domain/repositories/budget-template.repository';
import { BudgetTemplate } from '../../domain/entities/budget-template.entity';
import { TemplateLine } from '../../domain/value-objects/template-line.value-object';
import { TemplateInfo } from '../../domain/value-objects/template-info.value-object';

type BudgetTemplateRow =
  Database['public']['Tables']['budget_templates']['Row'];
type BudgetTemplateInsert =
  Database['public']['Tables']['budget_templates']['Insert'];
type BudgetTemplateUpdate =
  Database['public']['Tables']['budget_templates']['Update'];
type TemplateLineRow =
  Database['public']['Tables']['budget_template_lines']['Row'];
type TemplateLineInsert =
  Database['public']['Tables']['budget_template_lines']['Insert'];

@Injectable()
export class SupabaseBudgetTemplateRepository
  implements BudgetTemplateRepository
{
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(SupabaseBudgetTemplateRepository.name);
  }

  async findById(
    id: string,
    userId: string,
  ): Promise<Result<BudgetTemplate | null>> {
    const startTime = performance.now();

    try {
      const client = this.getClient();

      // Fetch template with lines
      const { data: templateData, error: templateError } = await client
        .from('budget_templates')
        .select(
          `
          *,
          budget_template_lines (*)
        `,
        )
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (templateError) {
        if (templateError.code === 'PGRST116') {
          // Not found
          const duration = performance.now() - startTime;
          this.logger.debug({
            operation: 'find-template-by-id.not-found',
            templateId: id,
            userId,
            duration,
          });
          return Result.ok(null);
        }
        throw templateError;
      }

      if (!templateData) {
        return Result.ok(null);
      }

      // Map to domain entity
      const entity = await this.mapToDomainEntity(templateData);

      const duration = performance.now() - startTime;
      this.logger.debug({
        operation: 'find-template-by-id.success',
        templateId: id,
        userId,
        duration,
      });

      return entity;
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'find-template-by-id.error',
        templateId: id,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to find budget template',
          'REPOSITORY_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async findByUserId(userId: string): Promise<Result<BudgetTemplate[]>> {
    const startTime = performance.now();

    try {
      const client = this.getClient();

      const { data: templates, error } = await client
        .from('budget_templates')
        .select(
          `
          *,
          budget_template_lines (*)
        `,
        )
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const entities: BudgetTemplate[] = [];
      for (const template of templates || []) {
        const entityResult = await this.mapToDomainEntity(template);
        if (entityResult.isSuccess) {
          entities.push(entityResult.getValue());
        }
      }

      const duration = performance.now() - startTime;
      this.logger.debug({
        operation: 'find-templates-by-user.success',
        userId,
        count: entities.length,
        duration,
      });

      return Result.ok(entities);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'find-templates-by-user.error',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to find budget templates',
          'REPOSITORY_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async findDefaultByUserId(
    userId: string,
  ): Promise<Result<BudgetTemplate | null>> {
    const startTime = performance.now();

    try {
      const client = this.getClient();

      const { data: templateData, error } = await client
        .from('budget_templates')
        .select(
          `
          *,
          budget_template_lines (*)
        `,
        )
        .eq('user_id', userId)
        .eq('is_default', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return Result.ok(null);
        }
        throw error;
      }

      if (!templateData) {
        return Result.ok(null);
      }

      const entity = await this.mapToDomainEntity(templateData);

      const duration = performance.now() - startTime;
      this.logger.debug({
        operation: 'find-default-template.success',
        userId,
        templateId: templateData.id,
        duration,
      });

      return entity;
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'find-default-template.error',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to find default template',
          'REPOSITORY_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async save(template: BudgetTemplate): Promise<Result<BudgetTemplate>> {
    const startTime = performance.now();

    try {
      const client = this.getClient();
      const data = this.mapToDbData(template);

      const { data: saved, error } = await client
        .from('budget_templates')
        .upsert(data)
        .select()
        .single();

      if (error) throw error;

      // Reload with lines
      const reloadResult = await this.findById(saved.id, saved.user_id);
      if (reloadResult.isFailure) {
        return reloadResult;
      }

      const duration = performance.now() - startTime;
      this.logger.debug({
        operation: 'save-template.success',
        templateId: saved.id,
        userId: saved.user_id,
        duration,
      });

      return Result.ok(reloadResult.getValue()!);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'save-template.error',
        templateId: template.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to save budget template',
          'REPOSITORY_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async saveWithLines(
    template: BudgetTemplate,
  ): Promise<Result<BudgetTemplate>> {
    const startTime = performance.now();

    try {
      const client = this.getClient();

      // Start transaction
      const templateData = this.mapToDbData(template);

      // Save template
      const { data: savedTemplate, error: templateError } = await client
        .from('budget_templates')
        .upsert(templateData)
        .select()
        .single();

      if (templateError) throw templateError;

      // Delete existing lines
      const { error: deleteError } = await client
        .from('budget_template_lines')
        .delete()
        .eq('template_id', savedTemplate.id);

      if (deleteError) throw deleteError;

      // Save new lines
      if (template.lines.length > 0) {
        const linesData = template.lines.map((line) =>
          this.mapLineToDbData(line, savedTemplate.id),
        );

        const { error: linesError } = await client
          .from('budget_template_lines')
          .insert(linesData);

        if (linesError) throw linesError;
      }

      // Reload complete template
      const reloadResult = await this.findById(
        savedTemplate.id,
        savedTemplate.user_id,
      );
      if (reloadResult.isFailure) {
        return reloadResult;
      }

      const duration = performance.now() - startTime;
      this.logger.debug({
        operation: 'save-template-with-lines.success',
        templateId: savedTemplate.id,
        userId: savedTemplate.user_id,
        linesCount: template.lines.length,
        duration,
      });

      return Result.ok(reloadResult.getValue()!);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'save-template-with-lines.error',
        templateId: template.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to save budget template with lines',
          'REPOSITORY_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async delete(id: string, userId: string): Promise<Result<void>> {
    const startTime = performance.now();

    try {
      const client = this.getClient();

      const { error } = await client
        .from('budget_templates')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;

      const duration = performance.now() - startTime;
      this.logger.debug({
        operation: 'delete-template.success',
        templateId: id,
        userId,
        duration,
      });

      return Result.ok();
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'delete-template.error',
        templateId: id,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to delete budget template',
          'REPOSITORY_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async exists(id: string, userId: string): Promise<Result<boolean>> {
    const startTime = performance.now();

    try {
      const client = this.getClient();

      const { count, error } = await client
        .from('budget_templates')
        .select('id', { count: 'exact', head: true })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;

      const duration = performance.now() - startTime;
      this.logger.debug({
        operation: 'check-template-exists.success',
        templateId: id,
        userId,
        exists: count! > 0,
        duration,
      });

      return Result.ok(count! > 0);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'check-template-exists.error',
        templateId: id,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to check if template exists',
          'REPOSITORY_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async countByUserId(userId: string): Promise<Result<number>> {
    const startTime = performance.now();

    try {
      const client = this.getClient();

      const { count, error } = await client
        .from('budget_templates')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) throw error;

      const duration = performance.now() - startTime;
      this.logger.debug({
        operation: 'count-templates.success',
        userId,
        count,
        duration,
      });

      return Result.ok(count || 0);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'count-templates.error',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to count templates',
          'REPOSITORY_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async setAsDefault(id: string, userId: string): Promise<Result<void>> {
    const startTime = performance.now();

    try {
      const client = this.getClient();

      // Unset all other defaults for this user
      const { error: unsetError } = await client
        .from('budget_templates')
        .update({ is_default: false })
        .eq('user_id', userId)
        .neq('id', id);

      if (unsetError) throw unsetError;

      // Set the specified template as default
      const { error: setError } = await client
        .from('budget_templates')
        .update({ is_default: true })
        .eq('id', id)
        .eq('user_id', userId);

      if (setError) throw setError;

      const duration = performance.now() - startTime;
      this.logger.debug({
        operation: 'set-as-default.success',
        templateId: id,
        userId,
        duration,
      });

      return Result.ok();
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'set-as-default.error',
        templateId: id,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to set template as default',
          'REPOSITORY_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async findLinesByTemplateId(
    templateId: string,
    userId: string,
  ): Promise<Result<TemplateLine[]>> {
    const startTime = performance.now();

    try {
      const client = this.getClient();

      // First verify the template belongs to the user
      const { data: template, error: templateError } = await client
        .from('budget_templates')
        .select('id')
        .eq('id', templateId)
        .eq('user_id', userId)
        .single();

      if (templateError || !template) {
        return Result.ok([]);
      }

      // Get lines
      const { data: lines, error } = await client
        .from('budget_template_lines')
        .select('*')
        .eq('template_id', templateId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const domainLines: TemplateLine[] = [];
      for (const line of lines || []) {
        const lineResult = this.mapLineToDomain(line);
        if (lineResult.isSuccess) {
          domainLines.push(lineResult.getValue());
        }
      }

      const duration = performance.now() - startTime;
      this.logger.debug({
        operation: 'find-template-lines.success',
        templateId,
        userId,
        count: domainLines.length,
        duration,
      });

      return Result.ok(domainLines);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'find-template-lines.error',
        templateId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to find template lines',
          'REPOSITORY_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async saveLines(
    templateId: string,
    lines: TemplateLine[],
    userId: string,
  ): Promise<Result<TemplateLine[]>> {
    const startTime = performance.now();

    try {
      const client = this.getClient();

      // Verify template ownership
      const { data: template, error: templateError } = await client
        .from('budget_templates')
        .select('id')
        .eq('id', templateId)
        .eq('user_id', userId)
        .single();

      if (templateError || !template) {
        return Result.fail(
          new GenericDomainException(
            'Template not found',
            'TEMPLATE_NOT_FOUND',
            'Template not found or access denied',
          ),
        );
      }

      // Save lines
      const linesData = lines.map((line) =>
        this.mapLineToDbData(line, templateId),
      );

      const { data: savedLines, error } = await client
        .from('budget_template_lines')
        .insert(linesData)
        .select();

      if (error) throw error;

      const domainLines: TemplateLine[] = [];
      for (const line of savedLines || []) {
        const lineResult = this.mapLineToDomain(line);
        if (lineResult.isSuccess) {
          domainLines.push(lineResult.getValue());
        }
      }

      const duration = performance.now() - startTime;
      this.logger.debug({
        operation: 'save-template-lines.success',
        templateId,
        userId,
        count: domainLines.length,
        duration,
      });

      return Result.ok(domainLines);
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'save-template-lines.error',
        templateId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to save template lines',
          'REPOSITORY_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async deleteLine(
    templateId: string,
    lineId: string,
    userId: string,
  ): Promise<Result<void>> {
    const startTime = performance.now();

    try {
      const client = this.getClient();

      // Verify template ownership
      const { data: template, error: templateError } = await client
        .from('budget_templates')
        .select('id')
        .eq('id', templateId)
        .eq('user_id', userId)
        .single();

      if (templateError || !template) {
        return Result.fail(
          new GenericDomainException(
            'Template not found',
            'TEMPLATE_NOT_FOUND',
            'Template not found or access denied',
          ),
        );
      }

      const { error } = await client
        .from('budget_template_lines')
        .delete()
        .eq('id', lineId)
        .eq('template_id', templateId);

      if (error) throw error;

      const duration = performance.now() - startTime;
      this.logger.debug({
        operation: 'delete-template-line.success',
        templateId,
        lineId,
        userId,
        duration,
      });

      return Result.ok();
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'delete-template-line.error',
        templateId,
        lineId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to delete template line',
          'REPOSITORY_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async deleteAllLines(
    templateId: string,
    userId: string,
  ): Promise<Result<void>> {
    const startTime = performance.now();

    try {
      const client = this.getClient();

      // Verify template ownership
      const { data: template, error: templateError } = await client
        .from('budget_templates')
        .select('id')
        .eq('id', templateId)
        .eq('user_id', userId)
        .single();

      if (templateError || !template) {
        return Result.fail(
          new GenericDomainException(
            'Template not found',
            'TEMPLATE_NOT_FOUND',
            'Template not found or access denied',
          ),
        );
      }

      const { error } = await client
        .from('budget_template_lines')
        .delete()
        .eq('template_id', templateId);

      if (error) throw error;

      const duration = performance.now() - startTime;
      this.logger.debug({
        operation: 'delete-all-template-lines.success',
        templateId,
        userId,
        duration,
      });

      return Result.ok();
    } catch {
      const duration = performance.now() - startTime;
      this.logger.error({
        operation: 'delete-all-template-lines.error',
        templateId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to delete all template lines',
          'REPOSITORY_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  private getClient(): SupabaseClient<Database> {
    // This method will be replaced when we properly inject the client
    // For now, return a placeholder
    return {} as SupabaseClient<Database>;
  }

  private async mapToDomainEntity(
    data: BudgetTemplateRow & { budget_template_lines?: TemplateLineRow[] },
  ): Promise<Result<BudgetTemplate>> {
    try {
      // Map template info
      const infoResult = TemplateInfo.create({
        name: data.name,
        description: data.description,
        isDefault: data.is_default,
      });

      if (infoResult.isFailure) {
        return Result.fail(infoResult.error);
      }

      // Map lines
      const lines: TemplateLine[] = [];
      for (const lineData of data.budget_template_lines || []) {
        const lineResult = this.mapLineToDomain(lineData);
        if (lineResult.isFailure) {
          return Result.fail(lineResult.error);
        }
        lines.push(lineResult.getValue());
      }

      // Create entity
      return BudgetTemplate.create(
        {
          userId: data.user_id,
          info: infoResult.getValue(),
          lines,
        },
        data.id,
      );
    } catch {
      return Result.fail(
        new GenericDomainException(
          'Failed to map to domain entity',
          'MAPPING_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  private mapLineToDomain(data: TemplateLineRow): Result<TemplateLine> {
    return TemplateLine.create(
      {
        name: data.name,
        amount: data.amount,
        kind: data.kind as 'INCOME' | 'FIXED_EXPENSE' | 'VARIABLE_EXPENSE',
        recurrence: data.recurrence as 'fixed' | 'estimated',
        description: data.description,
      },
      data.id,
    );
  }

  private mapToDbData(
    template: BudgetTemplate,
  ): BudgetTemplateInsert | BudgetTemplateUpdate {
    return {
      id: template.id,
      user_id: template.userId,
      name: template.info.name,
      description: template.info.description,
      is_default: template.info.isDefault,
      created_at: template.createdAt.toISOString(),
      updated_at: template.updatedAt.toISOString(),
    };
  }

  private mapLineToDbData(
    line: TemplateLine,
    templateId: string,
  ): TemplateLineInsert {
    return {
      id: line.id,
      template_id: templateId,
      name: line.name,
      amount: line.amount,
      kind: line.kind,
      recurrence: line.recurrence,
      description: line.description,
    };
  }
}
