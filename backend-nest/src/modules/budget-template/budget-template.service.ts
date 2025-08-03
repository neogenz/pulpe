import { type Database, Tables, TablesInsert } from '@/types/database.types';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  type BudgetTemplateCreate,
  type BudgetTemplateCreateFromOnboarding,
  type BudgetTemplateCreateResponse,
  type BudgetTemplateDeleteResponse,
  type BudgetTemplateListResponse,
  type BudgetTemplateResponse,
  type BudgetTemplateUpdate,
  type TemplateLine,
  type TemplateLineCreateWithoutTemplateId,
  type TemplateLineDeleteResponse,
  type TemplateLineListResponse,
  type TemplateLineResponse,
  type TemplateLineUpdate,
  type TemplateLineUpdateWithId,
  type TemplateLinesBulkUpdate,
  type TemplateLinesBulkUpdateResponse,
  budgetTemplateCreateSchema,
  budgetTemplateCreateFromOnboardingSchema,
  budgetTemplateUpdateSchema,
  templateLineCreateWithoutTemplateIdSchema,
  templateLineUpdateSchema,
  templateLinesBulkUpdateSchema,
  templateLinesBulkOperationsSchema,
  type TemplateLinesBulkOperations,
  type TemplateLinesBulkOperationsResponse,
} from '@pulpe/shared';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import * as budgetTemplateMappers from './budget-template.mappers';

@Injectable()
export class BudgetTemplateService {
  constructor(
    @InjectPinoLogger(BudgetTemplateService.name)
    private readonly logger: PinoLogger,
  ) {}

  // ============ TEMPLATE METHODS ============

  async findAll(
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateListResponse> {
    const startTime = Date.now();

    try {
      const { data, error } = await supabase
        .from('template')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.logger.info(
        {
          operation: 'findAll',
          userId: user.id,
          duration: Date.now() - startTime,
          count: data?.length || 0,
        },
        'Templates retrieved successfully',
      );

      return {
        success: true,
        data: budgetTemplateMappers.toApiTemplateList(data || []),
      };
    } catch (error) {
      this.logger.error(
        {
          operation: 'findAll',
          userId: user.id,
          duration: Date.now() - startTime,
          err: error,
        },
        'Failed to list templates',
      );
      throw new InternalServerErrorException('Failed to retrieve templates');
    }
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateResponse> {
    const startTime = Date.now();

    try {
      await this.validateTemplateAccess(id, user, supabase);

      const { data, error } = await supabase
        .from('template')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) throw new NotFoundException('Template not found');

      this.logger.info(
        {
          operation: 'findOne',
          userId: user.id,
          entityId: id,
          duration: Date.now() - startTime,
        },
        'Template retrieved successfully',
      );

      return { success: true, data: budgetTemplateMappers.toApiTemplate(data) };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;

      this.logger.error(
        {
          operation: 'findOne',
          userId: user.id,
          entityId: id,
          duration: Date.now() - startTime,
          err: error,
        },
        'Failed to retrieve template',
      );
      throw new InternalServerErrorException('Failed to retrieve template');
    }
  }

  async create(
    createDto: BudgetTemplateCreate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateCreateResponse> {
    const startTime = Date.now();

    try {
      const validated = budgetTemplateCreateSchema.parse(createDto);
      const result = await this.executeTemplateCreation(
        validated,
        user,
        supabase,
      );

      this.logger.info(
        {
          operation: 'create',
          userId: user.id,
          entityId: result.data.template.id,
          duration: Date.now() - startTime,
        },
        'Template created successfully',
      );

      return result;
    } catch (error) {
      this.logger.error(
        {
          operation: 'create',
          userId: user.id,
          duration: Date.now() - startTime,
          err: error,
        },
        'Failed to create template',
      );

      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to create template');
    }
  }

  private async executeTemplateCreation(
    validated: BudgetTemplateCreate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateCreateResponse> {
    const template = await this.createTemplateWithLines(
      validated,
      user,
      supabase,
    );

    const { data: lines } = await supabase
      .from('template_line')
      .select('*')
      .eq('template_id', template.id)
      .order('name', { ascending: true });

    return {
      success: true,
      data: {
        template: budgetTemplateMappers.toApiTemplate(template),
        lines: budgetTemplateMappers.toApiTemplateLineList(lines || []),
      },
    };
  }

  private async createTemplateWithLines(
    validated: BudgetTemplateCreate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'template'>> {
    const rpcLines = validated.lines.map((line) => ({
      name: line.name,
      amount: line.amount,
      kind: line.kind as Database['public']['Enums']['transaction_kind'],
      recurrence:
        line.recurrence as Database['public']['Enums']['transaction_recurrence'],
      description: line.description || '',
    }));

    const { data: templateRecord, error } = await supabase.rpc(
      'create_template_with_lines',
      {
        p_user_id: user.id,
        p_name: validated.name,
        p_description: validated.description,
        p_is_default: validated.isDefault || false,
        p_lines: rpcLines,
      },
    );

    if (error) throw error;
    if (!templateRecord)
      throw new InternalServerErrorException('Failed to create template');

    return templateRecord as unknown as Tables<'template'>;
  }

  async update(
    id: string,
    updateDto: BudgetTemplateUpdate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateResponse> {
    const startTime = Date.now();

    try {
      await this.validateTemplateAccess(id, user, supabase);
      const validated = budgetTemplateUpdateSchema.parse(updateDto);

      if (validated.isDefault) {
        await this.resetDefaultTemplates(user.id, id, supabase);
      }

      const data = await this.performTemplateUpdate(id, validated, supabase);

      this.logger.info(
        {
          operation: 'update',
          userId: user.id,
          entityId: id,
          duration: Date.now() - startTime,
        },
        'Template updated successfully',
      );

      return { success: true, data: budgetTemplateMappers.toApiTemplate(data) };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;

      this.logger.error(
        {
          operation: 'update',
          userId: user.id,
          entityId: id,
          duration: Date.now() - startTime,
          err: error,
        },
        'Failed to update template',
      );
      throw new InternalServerErrorException('Failed to update template');
    }
  }

  private async resetDefaultTemplates(
    userId: string,
    excludeId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    await supabase
      .from('template')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true)
      .neq('id', excludeId);
  }

  private async performTemplateUpdate(
    id: string,
    validated: BudgetTemplateUpdate,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'template'>> {
    const { data, error } = await supabase
      .from('template')
      .update(budgetTemplateMappers.toDbTemplateUpdate(validated))
      .eq('id', id)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('Template not found');
    return data;
  }

  async remove(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateDeleteResponse> {
    const startTime = Date.now();

    try {
      await this.validateTemplateAccess(id, user, supabase);

      const { error } = await supabase.from('template').delete().eq('id', id);
      if (error) throw error;

      this.logger.info(
        {
          operation: 'remove',
          userId: user.id,
          entityId: id,
          duration: Date.now() - startTime,
        },
        'Template deleted successfully',
      );

      return { success: true, message: 'Template deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;

      this.logger.error(
        {
          operation: 'remove',
          userId: user.id,
          entityId: id,
          duration: Date.now() - startTime,
          err: error,
        },
        'Failed to delete template',
      );
      throw new InternalServerErrorException('Failed to delete template');
    }
  }

  async createFromOnboarding(
    onboardingData: BudgetTemplateCreateFromOnboarding,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateCreateResponse> {
    const startTime = Date.now();

    try {
      const validated =
        budgetTemplateCreateFromOnboardingSchema.parse(onboardingData);

      await this.checkOnboardingRateLimit(user.id, supabase);

      const lines = this.buildOnboardingTemplateLines(validated);
      const templateCreateDto: BudgetTemplateCreate = {
        name: validated.name || 'Mois Standard',
        description: validated.description,
        isDefault: validated.isDefault,
        lines,
      };

      this.logger.info(
        {
          operation: 'createFromOnboarding',
          userId: user.id,
          duration: Date.now() - startTime,
        },
        'Creating template from onboarding',
      );

      return this.create(templateCreateDto, user, supabase);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;

      this.logger.error(
        {
          operation: 'createFromOnboarding',
          userId: user.id,
          duration: Date.now() - startTime,
          err: error,
        },
        'Failed to create template from onboarding',
      );
      throw new InternalServerErrorException(
        'Failed to create template from onboarding',
      );
    }
  }

  private async checkOnboardingRateLimit(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: recentTemplates } = await supabase
      .from('template')
      .select('id')
      .eq('user_id', userId)
      .eq('is_from_onboarding', true)
      .gte('created_at', twentyFourHoursAgo.toISOString());

    if (recentTemplates && recentTemplates.length > 0) {
      throw new BadRequestException(
        'You can only create one template from onboarding per 24 hours',
      );
    }
  }

  private buildOnboardingTemplateLines(
    validated: BudgetTemplateCreateFromOnboarding,
  ): TemplateLineCreateWithoutTemplateId[] {
    const lines: TemplateLineCreateWithoutTemplateId[] = [];
    const fieldMappings = this.getOnboardingFieldMappings();

    for (const mapping of fieldMappings) {
      const amount = validated[
        mapping.field as keyof typeof validated
      ] as number;
      if (amount > 0) {
        lines.push({
          name: mapping.name,
          amount,
          kind: mapping.kind as 'INCOME' | 'FIXED_EXPENSE',
          recurrence: 'fixed',
          description: mapping.description,
        });
      }
    }

    if (validated.customTransactions) {
      lines.push(
        ...validated.customTransactions.map((t) => ({
          name: t.name,
          amount: t.amount,
          kind: t.type,
          recurrence: t.expenseType,
          description: t.description || '',
        })),
      );
    }

    return lines;
  }

  private getOnboardingFieldMappings() {
    return [
      {
        field: 'monthlyIncome',
        name: 'Salaire',
        kind: 'INCOME',
        description: 'Salaire & revenus mensuels',
      },
      {
        field: 'housingCosts',
        name: 'Loyer',
        kind: 'FIXED_EXPENSE',
        description: 'Loyer, assurances, etc.',
      },
      {
        field: 'healthInsurance',
        name: 'Assurance maladie',
        kind: 'FIXED_EXPENSE',
        description: 'Assurance maladie, etc.',
      },
      {
        field: 'phonePlan',
        name: 'Téléphone',
        kind: 'FIXED_EXPENSE',
        description: 'Frais de téléphone',
      },
      {
        field: 'transportCosts',
        name: 'Transport',
        kind: 'FIXED_EXPENSE',
        description: 'Transport en commun, véhicule, etc.',
      },
      {
        field: 'leasingCredit',
        name: 'Leasing',
        kind: 'FIXED_EXPENSE',
        description: 'Crédit, leasing, etc.',
      },
    ];
  }

  // ============ TEMPLATE LINE METHODS ============

  async findTemplateLines(
    templateId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineListResponse> {
    const startTime = Date.now();

    try {
      await this.validateTemplateAccess(templateId, user, supabase);
      const lines = await this.fetchTemplateLines(templateId, supabase);

      this.logger.info(
        {
          operation: 'findTemplateLines',
          userId: user.id,
          entityId: templateId,
          duration: Date.now() - startTime,
          lineCount: lines.length,
        },
        'Template lines retrieved successfully',
      );

      return {
        success: true,
        data: budgetTemplateMappers.toApiTemplateLineList(lines),
      };
    } catch (error) {
      this.logger.error(
        {
          operation: 'findTemplateLines',
          userId: user.id,
          entityId: templateId,
          duration: Date.now() - startTime,
          err: error,
        },
        'Failed to retrieve template lines',
      );

      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Failed to retrieve template lines',
      );
    }
  }

  private async fetchTemplateLines(
    templateId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'template_line'>[]> {
    const { data, error } = await supabase
      .from('template_line')
      .select('*')
      .eq('template_id', templateId)
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async createTemplateLine(
    templateId: string,
    createDto: TemplateLineCreateWithoutTemplateId,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineResponse> {
    const startTime = Date.now();

    try {
      const data = await this.executeTemplateLineCreation(
        templateId,
        createDto,
        user,
        supabase,
      );

      this.logger.info(
        {
          operation: 'createTemplateLine',
          userId: user.id,
          entityId: templateId,
          duration: Date.now() - startTime,
          lineId: data.id,
        },
        'Template line created successfully',
      );

      return {
        success: true,
        data: budgetTemplateMappers.toApiTemplateLine(data),
      };
    } catch (error) {
      this.handleTemplateLineError(error, 'createTemplateLine', {
        userId: user.id,
        entityId: templateId,
        duration: Date.now() - startTime,
      });
    }
  }

  private async executeTemplateLineCreation(
    templateId: string,
    createDto: TemplateLineCreateWithoutTemplateId,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'template_line'>> {
    await this.validateTemplateAccess(templateId, user, supabase);
    const validated =
      templateLineCreateWithoutTemplateIdSchema.parse(createDto);

    return this.insertTemplateLine(validated, templateId, supabase);
  }

  private handleTemplateLineError(
    error: unknown,
    operation: string,
    context: Record<string, unknown>,
  ): never {
    this.logger.error(
      { operation, ...context, err: error },
      `Failed to ${operation.replace(/([A-Z])/g, ' $1').toLowerCase()}`,
    );

    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestException ||
      error instanceof ForbiddenException
    )
      throw error;
    throw new InternalServerErrorException(
      `Failed to ${operation.replace(/([A-Z])/g, ' $1').toLowerCase()}`,
    );
  }

  private async insertTemplateLine(
    validated: TemplateLineCreateWithoutTemplateId,
    templateId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'template_line'>> {
    const { data, error } = await supabase
      .from('template_line')
      .insert(
        budgetTemplateMappers.toDbTemplateLineInsert(validated, templateId),
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async findTemplateLine(
    templateLineId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineResponse> {
    const startTime = Date.now();

    try {
      const line = await this.fetchAndValidateTemplateLine(
        templateLineId,
        user,
        supabase,
      );

      this.logger.info(
        {
          operation: 'findTemplateLine',
          userId: user.id,
          entityId: templateLineId,
          duration: Date.now() - startTime,
        },
        'Template line retrieved successfully',
      );

      return {
        success: true,
        data: budgetTemplateMappers.toApiTemplateLine(line),
      };
    } catch (error) {
      this.logger.error(
        {
          operation: 'findTemplateLine',
          userId: user.id,
          entityId: templateLineId,
          duration: Date.now() - startTime,
          err: error,
        },
        'Failed to retrieve template line',
      );

      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      )
        throw error;
      throw new InternalServerErrorException(
        'Failed to retrieve template line',
      );
    }
  }

  private async fetchAndValidateTemplateLine(
    templateLineId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'template_line'> & { template: Tables<'template'> }> {
    const { data, error } = await supabase
      .from('template_line')
      .select('*, template!inner(*)')
      .eq('id', templateLineId)
      .single();

    if (error || !data) throw new NotFoundException('Template line not found');

    if (data.template.user_id !== user.id) {
      throw new ForbiddenException(
        'You do not have access to this template line',
      );
    }

    return data;
  }

  async updateTemplateLine(
    templateLineId: string,
    updateDto: TemplateLineUpdate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineResponse> {
    const startTime = Date.now();

    try {
      await this.validateTemplateLineAccess(templateLineId, user, supabase);
      const validated = templateLineUpdateSchema.parse(updateDto);

      const data = await this.performTemplateLineUpdate(
        templateLineId,
        validated,
        supabase,
      );

      this.logTemplateLineSuccess(
        'updateTemplateLine',
        user.id,
        templateLineId,
        startTime,
        'Template line updated successfully',
      );

      return {
        success: true,
        data: budgetTemplateMappers.toApiTemplateLine(data),
      };
    } catch (error) {
      this.handleTemplateLineError(error, 'updateTemplateLine', {
        userId: user.id,
        entityId: templateLineId,
        duration: Date.now() - startTime,
      });
    }
  }

  private async validateTemplateLineAccess(
    templateLineId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const { data: existingLine } = await supabase
      .from('template_line')
      .select('*, template!inner(*)')
      .eq('id', templateLineId)
      .single();

    if (!existingLine) throw new NotFoundException('Template line not found');
    if (existingLine.template.user_id !== user.id) {
      throw new ForbiddenException(
        'You do not have access to this template line',
      );
    }
  }

  private async performTemplateLineUpdate(
    templateLineId: string,
    validated: TemplateLineUpdate,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'template_line'>> {
    const { data, error } = await supabase
      .from('template_line')
      .update(budgetTemplateMappers.toDbTemplateLineUpdate(validated))
      .eq('id', templateLineId)
      .select()
      .single();

    if (error || !data)
      throw error || new NotFoundException('Template line not found');
    return data;
  }

  async bulkUpdateTemplateLines(
    templateId: string,
    bulkUpdateDto: TemplateLinesBulkUpdate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLinesBulkUpdateResponse> {
    const startTime = Date.now();

    try {
      const data = await this.executeBulkUpdate(
        templateId,
        bulkUpdateDto,
        user,
        supabase,
      );

      this.logger.info(
        {
          operation: 'bulkUpdateTemplateLines',
          userId: user.id,
          entityId: templateId,
          duration: Date.now() - startTime,
          updateCount: data.length,
        },
        'Template lines bulk updated successfully',
      );

      return { success: true, data };
    } catch (error) {
      this.handleBulkUpdateError(error, user.id, templateId, startTime);
    }
  }

  private async executeBulkUpdate(
    templateId: string,
    bulkUpdateDto: TemplateLinesBulkUpdate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLine[]> {
    await this.validateTemplateAccess(templateId, user, supabase);
    const validated = templateLinesBulkUpdateSchema.parse(bulkUpdateDto);

    await this.validateBulkUpdateLines(validated, templateId, supabase);
    const allUpdatedLines = await this.performBulkUpdate(validated, supabase);

    return budgetTemplateMappers.toApiTemplateLineList(allUpdatedLines);
  }

  private handleBulkUpdateError(
    error: unknown,
    userId: string,
    entityId: string,
    startTime: number,
  ): never {
    this.logger.error(
      {
        operation: 'bulkUpdateTemplateLines',
        userId,
        entityId,
        duration: Date.now() - startTime,
        err: error,
      },
      'Failed to bulk update template lines',
    );

    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestException
    )
      throw error;
    throw new InternalServerErrorException(
      'Failed to bulk update template lines',
    );
  }

  private async validateBulkUpdateLines(
    validated: TemplateLinesBulkUpdate,
    templateId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const lineIds = validated.lines.map((l) => l.id);
    const { data: existingLines } = await supabase
      .from('template_line')
      .select('id, template_id')
      .in('id', lineIds);

    if (!existingLines || existingLines.length !== lineIds.length) {
      throw new NotFoundException('Some template lines not found');
    }

    if (existingLines.some((l) => l.template_id !== templateId)) {
      throw new BadRequestException(
        'All template lines must belong to the same template',
      );
    }
  }

  private async performBulkUpdate(
    validated: TemplateLinesBulkUpdate,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'template_line'>[]> {
    const updateGroups = this.groupUpdatesByProperties(validated.lines);

    const updatePromises = Array.from(updateGroups.values()).map(
      ({ ids, data }) =>
        supabase.from('template_line').update(data).in('id', ids).select(),
    );

    const results = await Promise.all(updatePromises);
    return results.flatMap((r) => r.data || []);
  }

  private groupUpdatesByProperties(
    lines: TemplateLineUpdateWithId[],
  ): Map<
    string,
    { ids: string[]; data: Partial<TablesInsert<'template_line'>> }
  > {
    const updateGroups = new Map<
      string,
      { ids: string[]; data: Partial<TablesInsert<'template_line'>> }
    >();

    for (const line of lines) {
      const { id, ...updateData } = line;
      const dbData = budgetTemplateMappers.toDbTemplateLineUpdate(updateData);
      const key = JSON.stringify(dbData);

      if (!updateGroups.has(key)) {
        updateGroups.set(key, { ids: [], data: dbData });
      }
      updateGroups.get(key)!.ids.push(id);
    }

    return updateGroups;
  }

  async bulkOperationsTemplateLines(
    templateId: string,
    bulkOperationsDto: TemplateLinesBulkOperations,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLinesBulkOperationsResponse> {
    const startTime = Date.now();
    try {
      const data = await this.executeBulkOperations(
        templateId,
        bulkOperationsDto,
        user,
        supabase,
      );
      this.logger.info(
        {
          operation: 'bulkOperationsTemplateLines',
          userId: user.id,
          entityId: templateId,
          operationCount: {
            create: bulkOperationsDto.create?.length || 0,
            update: bulkOperationsDto.update?.length || 0,
            delete: bulkOperationsDto.delete?.length || 0,
          },
          duration: Date.now() - startTime,
        },
        'Bulk operations on template lines completed successfully',
      );
      return data;
    } catch (error) {
      this.handleBulkOperationsError(error, user.id, templateId, startTime);
    }
  }

  private async executeBulkOperations(
    templateId: string,
    bulkOperationsDto: TemplateLinesBulkOperations,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLinesBulkOperationsResponse> {
    await this.validateTemplateAccess(templateId, user, supabase);
    const validated =
      templateLinesBulkOperationsSchema.parse(bulkOperationsDto);

    // Execute operations in order: delete, update, create
    const deletedIds = await this.performBulkDeletes(
      validated.delete,
      templateId,
      supabase,
    );
    const updatedLines = await this.performBulkUpdates(
      validated.update,
      templateId,
      supabase,
    );
    const createdLines = await this.performBulkCreates(
      validated.create,
      templateId,
      supabase,
    );

    return {
      success: true,
      data: {
        created: budgetTemplateMappers.toApiTemplateLineList(createdLines),
        updated: budgetTemplateMappers.toApiTemplateLineList(updatedLines),
        deleted: deletedIds,
      },
    };
  }

  private async performBulkDeletes(
    deleteIds: string[],
    templateId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<string[]> {
    if (!deleteIds.length) return [];

    // Validate all lines belong to the template
    const { data: existingLines } = await supabase
      .from('template_line')
      .select('id')
      .eq('template_id', templateId)
      .in('id', deleteIds);

    if (!existingLines || existingLines.length !== deleteIds.length) {
      throw new NotFoundException('Some template lines to delete not found');
    }

    // Delete the lines
    const { error } = await supabase
      .from('template_line')
      .delete()
      .in('id', deleteIds);

    if (error) throw error;
    return deleteIds;
  }

  private async performBulkUpdates(
    updates: TemplateLineUpdateWithId[],
    templateId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'template_line'>[]> {
    if (!updates.length) return [];

    // Validate all lines belong to the template
    const updateIds = updates.map((u) => u.id);
    const { data: existingLines } = await supabase
      .from('template_line')
      .select('id')
      .eq('template_id', templateId)
      .in('id', updateIds);

    if (!existingLines || existingLines.length !== updateIds.length) {
      throw new NotFoundException('Some template lines to update not found');
    }

    // Group updates by properties to optimize database queries
    const updateGroups = this.groupUpdatesByProperties(updates);

    const updatePromises = Array.from(updateGroups.values()).map(
      ({ ids, data }) =>
        supabase.from('template_line').update(data).in('id', ids).select(),
    );

    const results = await Promise.all(updatePromises);
    return results.flatMap((r) => r.data || []);
  }

  private async performBulkCreates(
    creates: TemplateLineCreateWithoutTemplateId[],
    templateId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'template_line'>[]> {
    if (!creates.length) return [];

    const inserts = creates.map((line) =>
      budgetTemplateMappers.toDbTemplateLineInsert(line, templateId),
    );

    const { data, error } = await supabase
      .from('template_line')
      .insert(inserts)
      .select();

    if (error) throw error;
    return data || [];
  }

  private handleBulkOperationsError(
    error: unknown,
    userId: string,
    entityId: string,
    startTime: number,
  ): never {
    this.logger.error(
      {
        operation: 'bulkOperationsTemplateLines',
        userId,
        entityId,
        duration: Date.now() - startTime,
        err: error,
      },
      'Failed to perform bulk operations on template lines',
    );

    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestException ||
      error instanceof ForbiddenException
    )
      throw error;
    throw new InternalServerErrorException(
      'Failed to perform bulk operations on template lines',
    );
  }

  async deleteTemplateLine(
    templateLineId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineDeleteResponse> {
    const startTime = Date.now();

    try {
      await this.validateTemplateLineAccess(templateLineId, user, supabase);
      await this.performTemplateLineDelete(templateLineId, supabase);

      this.logger.info(
        {
          operation: 'deleteTemplateLine',
          userId: user.id,
          entityId: templateLineId,
          duration: Date.now() - startTime,
        },
        'Template line deleted successfully',
      );

      return { success: true, message: 'Template line deleted successfully' };
    } catch (error) {
      this.logger.error(
        {
          operation: 'deleteTemplateLine',
          userId: user.id,
          entityId: templateLineId,
          duration: Date.now() - startTime,
          err: error,
        },
        'Failed to delete template line',
      );

      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      )
        throw error;
      throw new InternalServerErrorException('Failed to delete template line');
    }
  }

  private async performTemplateLineDelete(
    templateLineId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const { error } = await supabase
      .from('template_line')
      .delete()
      .eq('id', templateLineId);
    if (error) throw error;
  }

  private logTemplateLineSuccess(
    operation: string,
    userId: string,
    entityId: string,
    startTime: number,
    message: string,
  ): void {
    this.logger.info(
      {
        operation,
        userId,
        entityId,
        duration: Date.now() - startTime,
      },
      message,
    );
  }

  // ============ VALIDATION HELPER ============

  private async validateTemplateAccess(
    templateId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const { data, error } = await supabase
      .from('template')
      .select('user_id')
      .eq('id', templateId)
      .single();

    if (error || !data) throw new NotFoundException('Template not found');
    if (data.user_id !== user.id)
      throw new ForbiddenException('You do not have access to this template');
  }
}
