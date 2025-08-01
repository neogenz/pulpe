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
  type BudgetTemplateCreate,
  type BudgetTemplateCreateFromOnboarding,
  type BudgetTemplateCreateResponse,
  type BudgetTemplateDeleteResponse,
  type BudgetTemplateListResponse,
  type BudgetTemplateResponse,
  type BudgetTemplateUpdate,
  type TemplateLineCreateWithoutTemplateId,
  type TemplateLineDeleteResponse,
  type TemplateLineListResponse,
  type TemplateLineResponse,
  type TemplateLineUpdate,
  type TemplateLinesBulkUpdate,
  type TemplateLinesBulkUpdateResponse,
  budgetTemplateCreateSchema as createBudgetTemplateSchema,
  budgetTemplateCreateFromOnboardingSchema,
  budgetTemplateUpdateSchema as updateBudgetTemplateSchema,
} from '@pulpe/shared';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BudgetTemplateMapper } from './budget-template.mapper';
import { TemplateValidationService } from './services/template-validation.service';
import { TemplateLineService } from './services/template-line.service';

@Injectable()
export class BudgetTemplateService {
  constructor(
    @InjectPinoLogger(BudgetTemplateService.name)
    private readonly logger: PinoLogger,
    private readonly budgetTemplateMapper: BudgetTemplateMapper,
    private readonly templateValidationService: TemplateValidationService,
    private readonly templateLineService: TemplateLineService,
  ) {}

  async findAll(
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateListResponse> {
    try {
      const { data: templatesDb, error } = await supabase
        .from('template')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error({ err: error }, 'Failed to fetch budget templates');
        throw new InternalServerErrorException(
          'Erreur lors de la récupération des templates',
        );
      }

      const apiData = this.budgetTemplateMapper.toApiList(templatesDb || []);

      return {
        success: true as const,
        data: apiData,
      } as BudgetTemplateListResponse;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to list budget templates');
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async create(
    createTemplateDto: BudgetTemplateCreate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateCreateResponse> {
    try {
      this.validateCreateTemplateInput(createTemplateDto);
      const rpcLines = this.transformLinesToRpcFormat(createTemplateDto.lines);
      const templateRecord = await this.createTemplateWithLines(
        createTemplateDto,
        user,
        rpcLines,
        supabase,
      );
      const templateData = this.validateAndMapTemplateRecord(templateRecord);
      const mappedLines = await this.fetchAndMapTemplateLines(
        templateRecord.id,
        supabase,
      );

      return {
        success: true,
        data: {
          template: templateData,
          lines: mappedLines,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to create budget template');
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  private validateCreateTemplateInput(
    createTemplateDto: BudgetTemplateCreate,
  ): void {
    const validationResult =
      createBudgetTemplateSchema.safeParse(createTemplateDto);
    if (!validationResult.success) {
      throw new BadRequestException(
        `Données invalides: ${validationResult.error.message}`,
      );
    }
  }

  private transformLinesToRpcFormat(
    lines: TemplateLineCreateWithoutTemplateId[],
  ) {
    return lines.map((line) => ({
      name: line.name,
      amount: line.amount,
      kind: line.kind as Database['public']['Enums']['transaction_kind'],
      recurrence:
        line.recurrence as Database['public']['Enums']['transaction_recurrence'],
      description: line.description || '',
    }));
  }

  private async executeCreateTemplateRpc(
    createTemplateDto: BudgetTemplateCreate,
    user: AuthenticatedUser,
    rpcLines: ReturnType<typeof this.transformLinesToRpcFormat>,
    supabase: AuthenticatedSupabaseClient,
  ) {
    const { data: templateRecord, error } = await supabase.rpc(
      'create_template_with_lines',
      {
        p_user_id: user.id,
        p_name: createTemplateDto.name,
        p_description: createTemplateDto.description,
        p_is_default: createTemplateDto.isDefault || false,
        p_lines: rpcLines,
      },
    );

    if (error) {
      this.handleRpcError(error, createTemplateDto, user, rpcLines);
    }

    return this.validateRpcResponse(templateRecord);
  }

  private handleRpcError(
    error: unknown,
    createTemplateDto: BudgetTemplateCreate,
    user: AuthenticatedUser,
    rpcLines: ReturnType<typeof this.transformLinesToRpcFormat>,
  ): never {
    const errorDetails = error as any;
    this.logger.error(
      {
        err: error,
        errorCode: errorDetails?.code,
        errorDetails: errorDetails?.details,
        errorHint: errorDetails?.hint,
        errorMessage: errorDetails?.message,
        rpcParams: {
          p_user_id: user.id,
          p_name: createTemplateDto.name,
          p_description: createTemplateDto.description || null,
          p_is_default: createTemplateDto.isDefault || false,
          p_lines: rpcLines,
        },
      },
      'RPC function create_template_with_lines failed',
    );
    throw new InternalServerErrorException(
      `Erreur lors de la création du template: ${errorDetails?.message || 'Unknown RPC error'}`,
    );
  }

  private validateRpcResponse(templateRecord: unknown): Tables<'template'> {
    if (
      !templateRecord ||
      typeof templateRecord !== 'object' ||
      !('id' in templateRecord)
    ) {
      this.logger.error({ templateRecord }, 'Invalid template record returned');
      throw new InternalServerErrorException(
        'Template record invalide retourné par la fonction',
      );
    }

    return templateRecord as Tables<'template'>;
  }

  private async createTemplateWithLines(
    createTemplateDto: BudgetTemplateCreate,
    user: AuthenticatedUser,
    rpcLines: ReturnType<typeof this.transformLinesToRpcFormat>,
    supabase: AuthenticatedSupabaseClient,
  ) {
    return this.executeCreateTemplateRpc(
      createTemplateDto,
      user,
      rpcLines,
      supabase,
    );
  }

  private validateAndMapTemplateRecord(templateRecord: Tables<'template'>) {
    const templateData = this.budgetTemplateMapper.toApi(templateRecord);
    if (!templateData) {
      throw new InternalServerErrorException(
        'Erreur lors de la validation du template créé',
      );
    }
    return templateData;
  }

  /**
   * Fetches template lines for a given template ID and maps them to API format.
   * Throws an error if fetching fails to maintain data consistency.
   * @param templateId - The ID of the template to fetch lines for
   * @param supabase - Authenticated Supabase client
   * @throws InternalServerErrorException if fetching template lines fails
   */
  private async fetchAndMapTemplateLines(
    templateId: string,
    supabase: AuthenticatedSupabaseClient,
  ) {
    return this.templateLineService.fetchAndMapTemplateLines(
      templateId,
      supabase,
    );
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateResponse> {
    try {
      // Explicit authorization check before RLS
      await this.templateValidationService.validateTemplateAccess(
        id,
        user,
        supabase,
      );

      const { data: templateDb, error } = await supabase
        .from('template')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !templateDb) {
        throw new NotFoundException(
          'Template introuvable ou accès non autorisé',
        );
      }

      const apiData = this.budgetTemplateMapper.toApi(templateDb);
      if (!apiData) {
        throw new NotFoundException(
          'Template introuvable ou données invalides',
        );
      }

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to fetch budget template');
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  private validateUpdateTemplateDto(
    updateTemplateDto: BudgetTemplateUpdate,
  ): void {
    const validationResult =
      updateBudgetTemplateSchema.safeParse(updateTemplateDto);
    if (!validationResult.success) {
      throw new BadRequestException(
        `Données invalides: ${validationResult.error.message}`,
      );
    }
  }

  private prepareUpdateData(updateTemplateDto: BudgetTemplateUpdate) {
    return {
      ...(updateTemplateDto.name && { name: updateTemplateDto.name }),
      ...(updateTemplateDto.description !== undefined && {
        description: updateTemplateDto.description,
      }),
      ...(updateTemplateDto.isDefault !== undefined && {
        is_default: updateTemplateDto.isDefault,
      }),
      updated_at: new Date().toISOString(),
    };
  }

  private async updateTemplateInDb(
    id: string,
    updateData: ReturnType<typeof this.prepareUpdateData>,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'template'>> {
    const { data: templateDb, error } = await supabase
      .from('template')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !templateDb) {
      this.logger.error({ err: error }, 'Failed to update budget template');
      throw new NotFoundException(
        'Template introuvable ou modification non autorisée',
      );
    }

    return templateDb;
  }

  async update(
    id: string,
    updateTemplateDto: BudgetTemplateUpdate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateResponse> {
    try {
      // Explicit authorization check - require ownership for updates
      await this.templateValidationService.validateTemplateAccess(
        id,
        user,
        supabase,
      );

      this.validateUpdateTemplateDto(updateTemplateDto);

      if (updateTemplateDto.isDefault) {
        await this.ensureOnlyOneDefault(supabase, user.id, id);
      }

      const updateData = this.prepareUpdateData(updateTemplateDto);
      const templateDb = await this.updateTemplateInDb(
        id,
        updateData,
        supabase,
      );

      const apiData = this.budgetTemplateMapper.toApi(templateDb);
      if (!apiData) {
        throw new InternalServerErrorException(
          'Erreur lors de la validation du template modifié',
        );
      }

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to update budget template');
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async remove(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateDeleteResponse> {
    try {
      // Explicit authorization check - require ownership for deletion
      await this.templateValidationService.validateTemplateAccess(
        id,
        user,
        supabase,
      );

      const { error } = await supabase.from('template').delete().eq('id', id);

      if (error) {
        this.logger.error({ err: error }, 'Failed to delete budget template');
        throw new NotFoundException(
          'Template introuvable ou suppression non autorisée',
        );
      }

      return {
        success: true,
        message: 'Template supprimé avec succès',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to delete budget template');
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async findTemplateLines(
    templateId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineListResponse> {
    return this.templateLineService.findTemplateLines(
      templateId,
      user,
      supabase,
    );
  }

  async createTemplateLine(
    templateId: string,
    createLineDto: TemplateLineCreateWithoutTemplateId,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineResponse> {
    return this.templateLineService.createTemplateLine(
      templateId,
      createLineDto,
      user,
      supabase,
    );
  }

  async findTemplateLine(
    templateId: string,
    lineId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineResponse> {
    // Note: templateId is passed for validation but the service uses lineId directly
    return this.templateLineService.findTemplateLine(lineId, user, supabase);
  }

  async updateTemplateLine(
    templateId: string,
    lineId: string,
    updateLineDto: TemplateLineUpdate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineResponse> {
    return this.templateLineService.updateTemplateLine(
      lineId,
      updateLineDto,
      user,
      supabase,
    );
  }

  async bulkUpdateTemplateLines(
    templateId: string,
    bulkUpdateDto: TemplateLinesBulkUpdate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLinesBulkUpdateResponse> {
    return this.templateLineService.bulkUpdateTemplateLines(
      templateId,
      bulkUpdateDto,
      user,
      supabase,
    );
  }

  async deleteTemplateLine(
    templateId: string,
    lineId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineDeleteResponse> {
    return this.templateLineService.deleteTemplateLine(lineId, user, supabase);
  }

  private async ensureOnlyOneDefault(
    supabase: AuthenticatedSupabaseClient,
    userId: string,
    excludeId?: string,
  ): Promise<void> {
    const { error } = await supabase
      .from('template')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true)
      .neq('id', excludeId || '');

    if (error) {
      this.logger.error(
        { err: error },
        'Failed to deactivate default templates',
      );
      throw new InternalServerErrorException(
        'Erreur lors de la gestion des templates par défaut',
      );
    }
  }

  private readonly onboardingFieldMappings = [
    {
      field: 'monthlyIncome' as const,
      name: 'Salaire',
      kind: 'INCOME' as const,
      description: 'Salaire & revenus mensuels',
    },
    {
      field: 'housingCosts' as const,
      name: 'Loyer',
      kind: 'FIXED_EXPENSE' as const,
      description: 'Loyer, assurances, etc.',
    },
    {
      field: 'healthInsurance' as const,
      name: 'Assurance maladie',
      kind: 'FIXED_EXPENSE' as const,
      description: 'Assurance maladie, etc.',
    },
    {
      field: 'phonePlan' as const,
      name: 'Téléphone',
      kind: 'FIXED_EXPENSE' as const,
      description: 'Frais de téléphone',
    },
    {
      field: 'transportCosts' as const,
      name: 'Transport',
      kind: 'FIXED_EXPENSE' as const,
      description: 'Transport en commun, véhicule, etc.',
    },
    {
      field: 'leasingCredit' as const,
      name: 'Leasing',
      kind: 'FIXED_EXPENSE' as const,
      description: 'Crédit, leasing, etc.',
    },
  ];

  private createLineFromOnboardingField(
    amount: number,
    name: string,
    kind: 'INCOME' | 'FIXED_EXPENSE',
    description: string,
  ): TemplateLineCreateWithoutTemplateId {
    return {
      name,
      amount,
      kind,
      recurrence: 'fixed',
      description,
    };
  }

  private createLinesFromCustomTransactions(
    customTransactions: BudgetTemplateCreateFromOnboarding['customTransactions'],
  ): TemplateLineCreateWithoutTemplateId[] {
    return (
      customTransactions?.map((transaction) => ({
        name: transaction.name,
        amount: transaction.amount,
        kind: transaction.type,
        recurrence: transaction.expenseType,
        description: transaction.description || '',
      })) || []
    );
  }

  private createOnboardingTemplateLines(
    onboardingData: BudgetTemplateCreateFromOnboarding,
  ): TemplateLineCreateWithoutTemplateId[] {
    const lines: TemplateLineCreateWithoutTemplateId[] = [];

    for (const mapping of this.onboardingFieldMappings) {
      const amount = onboardingData[mapping.field];
      if (amount && amount > 0) {
        lines.push(
          this.createLineFromOnboardingField(
            amount,
            mapping.name,
            mapping.kind,
            mapping.description,
          ),
        );
      }
    }

    lines.push(
      ...this.createLinesFromCustomTransactions(
        onboardingData.customTransactions,
      ),
    );
    return lines;
  }

  async createFromOnboarding(
    onboardingData: BudgetTemplateCreateFromOnboarding,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateCreateResponse> {
    try {
      this.logOnboardingCreation(user, onboardingData);

      await this.templateValidationService.checkOnboardingRateLimit(
        user.id,
        supabase,
      );

      this.validateOnboardingData(onboardingData, user.id);

      const lines = this.createOnboardingTemplateLines(onboardingData);
      this.logCreatedLines(user.id, lines);

      const templateCreateDto = this.buildTemplateCreateDto(
        onboardingData,
        lines,
      );

      return this.create(templateCreateDto, user, supabase);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        { err: error },
        'Failed to create template from onboarding',
      );
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  private logOnboardingCreation(
    user: AuthenticatedUser,
    onboardingData: BudgetTemplateCreateFromOnboarding,
  ): void {
    this.logger.info(
      {
        userId: user.id,
        templateName: onboardingData.name,
        isDefault: onboardingData.isDefault,
        hasCustomTransactions:
          (onboardingData.customTransactions?.length || 0) > 0,
      },
      'Creating template from onboarding data',
    );
  }

  private validateOnboardingData(
    onboardingData: BudgetTemplateCreateFromOnboarding,
    userId: string,
  ): void {
    const validationResult =
      budgetTemplateCreateFromOnboardingSchema.safeParse(onboardingData);
    if (!validationResult.success) {
      this.logger.warn(
        { userId, validationErrors: validationResult.error.message },
        'Onboarding data validation failed',
      );
      throw new BadRequestException(
        `Invalid onboarding data: ${validationResult.error.message}`,
      );
    }
  }

  private logCreatedLines(
    userId: string,
    lines: TemplateLineCreateWithoutTemplateId[],
  ): void {
    this.logger.info(
      {
        userId,
        linesCount: lines.length,
        lines: lines.map((l) => ({
          name: l.name,
          kind: l.kind,
          recurrence: l.recurrence,
        })),
      },
      'Template lines created from onboarding',
    );
  }

  private buildTemplateCreateDto(
    onboardingData: BudgetTemplateCreateFromOnboarding,
    lines: TemplateLineCreateWithoutTemplateId[],
  ): BudgetTemplateCreate {
    return {
      name: onboardingData.name || 'Mois Standard',
      description: onboardingData.description,
      isDefault: onboardingData.isDefault,
      lines,
    };
  }
}
