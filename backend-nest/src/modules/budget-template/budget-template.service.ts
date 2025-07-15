import { type Database, Tables } from '@/types/database.types';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  BadRequestException,
  ForbiddenException,
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
  budgetTemplateCreateSchema as createBudgetTemplateSchema,
  budgetTemplateCreateFromOnboardingSchema,
  budgetTemplateUpdateSchema as updateBudgetTemplateSchema,
  templateLineCreateSchema,
  templateLineUpdateSchema,
} from '@pulpe/shared';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BudgetTemplateMapper } from './budget-template.mapper';

@Injectable()
export class BudgetTemplateService {
  constructor(
    @InjectPinoLogger(BudgetTemplateService.name)
    private readonly logger: PinoLogger,
    private readonly budgetTemplateMapper: BudgetTemplateMapper,
  ) {}

  /**
   * Validates template access for the authenticated user
   * All templates are user-owned, no public templates exist
   * @param templateId - The template ID to validate
   * @param user - The authenticated user
   * @param supabase - The authenticated Supabase client
   */
  private async validateTemplateAccess(
    templateId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const { data, error } = await supabase
      .from('template')
      .select('user_id, name')
      .eq('id', templateId)
      .single();

    if (error || !data) {
      this.logger.warn(
        { templateId, userId: user.id, error },
        'Template access validation failed - template not found',
      );
      throw new NotFoundException('Template not found');
    }

    const isOwner = data.user_id === user.id;

    if (!isOwner) {
      this.logger.warn(
        {
          templateId,
          userId: user.id,
          templateOwnerId: data.user_id,
          templateName: data.name,
        },
        'Template access validation failed - not the owner',
      );
      throw new ForbiddenException('You can only access your own templates');
    }

    this.logger.debug(
      { templateId, userId: user.id },
      'Template access validated successfully',
    );
  }

  /**
   * Validates template line access by first validating template access
   * @param templateId - The template ID
   * @param lineId - The template line ID
   * @param user - The authenticated user
   * @param supabase - The authenticated Supabase client
   * Ownership is always required for template line operations
   */
  private async validateTemplateLineAccess(
    templateId: string,
    lineId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    // First validate template access
    await this.validateTemplateAccess(templateId, user, supabase);

    // Then check if the line exists and belongs to the template
    const { data, error } = await supabase
      .from('template_line')
      .select('id')
      .eq('id', lineId)
      .eq('template_id', templateId)
      .single();

    if (error || !data) {
      this.logger.warn(
        { templateId, lineId, userId: user.id, error },
        'Template line access validation failed - line not found',
      );
      throw new NotFoundException('Template line not found');
    }

    this.logger.debug(
      { templateId, lineId, userId: user.id },
      'Template line access validated successfully',
    );
  }

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

  private async createTemplateWithLines(
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
      this.logger.error(
        {
          err: error,
          errorCode: error.code,
          errorDetails: error.details,
          errorHint: error.hint,
          errorMessage: error.message,
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
        `Erreur lors de la création du template: ${error.message || 'Unknown RPC error'}`,
      );
    }

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
    const { data: templateLinesDb, error: linesError } = await supabase
      .from('template_line')
      .select('*')
      .eq('template_id', templateId)
      .order('created_at', { ascending: false });

    if (linesError) {
      this.logger.error(
        { err: linesError, templateId },
        'Failed to fetch created template lines after successful creation',
      );
      throw new InternalServerErrorException(
        'Template créé avec succès mais impossible de récupérer les lignes',
      );
    }

    return (templateLinesDb || []).map(this.budgetTemplateMapper.toApiLine);
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateResponse> {
    try {
      // Explicit authorization check before RLS
      await this.validateTemplateAccess(id, user, supabase);

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
      await this.validateTemplateAccess(id, user, supabase);

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
      await this.validateTemplateAccess(id, user, supabase);

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
    try {
      // Explicit authorization check - allow read access for own or public templates
      await this.validateTemplateAccess(templateId, user, supabase);

      const { data: templateLinesDb, error } = await supabase
        .from('template_line')
        .select('*')
        .eq('template_id', templateId)
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error({ err: error }, 'Failed to fetch template lines');
        throw new InternalServerErrorException(
          'Erreur lors de la récupération des lignes du template',
        );
      }

      const mappedLines = templateLinesDb.map(
        this.budgetTemplateMapper.toApiLine,
      );

      return {
        success: true as const,
        data: mappedLines,
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to list template transactions');
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  // Template Line CRUD operations
  private validateTemplateLineInput(
    createLineDto: TemplateLineCreateWithoutTemplateId,
    templateId: string,
  ): void {
    const validationResult = templateLineCreateSchema.safeParse({
      ...createLineDto,
      templateId,
    });
    if (!validationResult.success) {
      throw new BadRequestException(
        `Données invalides: ${validationResult.error.message}`,
      );
    }
  }

  async createTemplateLine(
    templateId: string,
    createLineDto: TemplateLineCreateWithoutTemplateId,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineResponse> {
    try {
      // Explicit authorization check - require ownership to create lines
      await this.validateTemplateAccess(templateId, user, supabase);

      this.validateTemplateLineInput(createLineDto, templateId);

      const lineData = this.budgetTemplateMapper.toInsertLine(
        createLineDto,
        templateId,
      );
      const { data: lineDb, error } = await supabase
        .from('template_line')
        .insert(lineData)
        .select()
        .single();

      if (error || !lineDb) {
        this.logger.error({ err: error }, 'Failed to create template line');
        throw new InternalServerErrorException(
          'Erreur lors de la création de la ligne du template',
        );
      }

      const apiData = this.budgetTemplateMapper.toApiLine(lineDb);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to create template line');
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async findTemplateLine(
    templateId: string,
    lineId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineResponse> {
    try {
      // Explicit authorization check for template line access
      await this.validateTemplateLineAccess(templateId, lineId, user, supabase);

      // Find template line
      const { data: lineDb, error } = await supabase
        .from('template_line')
        .select('*')
        .eq('id', lineId)
        .eq('template_id', templateId)
        .single();

      if (error || !lineDb) {
        throw new NotFoundException('Ligne du template introuvable');
      }

      const apiData = this.budgetTemplateMapper.toApiLine(lineDb);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to find template line');
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  private validateTemplateLineUpdate(updateLineDto: TemplateLineUpdate): void {
    const validationResult = templateLineUpdateSchema.safeParse(updateLineDto);
    if (!validationResult.success) {
      throw new BadRequestException(
        `Données invalides: ${validationResult.error.message}`,
      );
    }
  }

  private async updateTemplateLineInDb(
    templateId: string,
    lineId: string,
    updateLineDto: TemplateLineUpdate,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'template_line'>> {
    const updateData = this.budgetTemplateMapper.toUpdateLine(updateLineDto);
    const { data: lineDb, error } = await supabase
      .from('template_line')
      .update(updateData)
      .eq('id', lineId)
      .eq('template_id', templateId)
      .select()
      .single();

    if (error || !lineDb) {
      this.logger.error({ err: error }, 'Failed to update template line');
      throw new NotFoundException(
        'Ligne du template introuvable ou modification non autorisée',
      );
    }

    return lineDb;
  }

  async updateTemplateLine(
    templateId: string,
    lineId: string,
    updateLineDto: TemplateLineUpdate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineResponse> {
    try {
      // Explicit authorization check - require ownership to update lines
      await this.validateTemplateLineAccess(templateId, lineId, user, supabase);

      this.validateTemplateLineUpdate(updateLineDto);

      const lineDb = await this.updateTemplateLineInDb(
        templateId,
        lineId,
        updateLineDto,
        supabase,
      );

      const apiData = this.budgetTemplateMapper.toApiLine(lineDb);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to update template line');
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async deleteTemplateLine(
    templateId: string,
    lineId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineDeleteResponse> {
    try {
      // Explicit authorization check - require ownership to delete lines
      await this.validateTemplateLineAccess(templateId, lineId, user, supabase);

      // Delete template line
      const { error } = await supabase
        .from('template_line')
        .delete()
        .eq('id', lineId)
        .eq('template_id', templateId);

      if (error) {
        this.logger.error({ err: error }, 'Failed to delete template line');
        throw new NotFoundException(
          'Ligne du template introuvable ou suppression non autorisée',
        );
      }

      return {
        success: true,
        message: 'Ligne du template supprimée avec succès',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to delete template line');
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
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
      name: 'Monthly Income',
      kind: 'INCOME' as const,
      description: 'Regular monthly income',
    },
    {
      field: 'housingCosts' as const,
      name: 'Housing Costs',
      kind: 'FIXED_EXPENSE' as const,
      description: 'Rent, utilities, home insurance',
    },
    {
      field: 'healthInsurance' as const,
      name: 'Health Insurance',
      kind: 'FIXED_EXPENSE' as const,
      description: 'Monthly health insurance premium',
    },
    {
      field: 'phonePlan' as const,
      name: 'Phone Plan',
      kind: 'FIXED_EXPENSE' as const,
      description: 'Monthly mobile plan',
    },
    {
      field: 'transportCosts' as const,
      name: 'Transport Costs',
      kind: 'FIXED_EXPENSE' as const,
      description: 'Public transport or vehicle expenses',
    },
    {
      field: 'leasingCredit' as const,
      name: 'Leasing/Credit',
      kind: 'FIXED_EXPENSE' as const,
      description: 'Monthly credit or leasing payments',
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

  /**
   * Rate limiting for onboarding template creation to prevent abuse
   * Allows maximum 3 template creations in the last 10 minutes
   */
  private async checkOnboardingRateLimit(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: recentTemplates, error } = await supabase
      .from('template')
      .select('id, created_at')
      .eq('user_id', userId)
      .gte('created_at', tenMinutesAgo)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.warn(
        { userId, error },
        'Failed to check rate limit for template creation',
      );
      // Don't block on rate limit check failure
      return;
    }

    const recentCount = recentTemplates?.length || 0;
    if (recentCount >= 3) {
      this.logger.warn(
        { userId, recentCount, timeWindow: '10 minutes' },
        'Rate limit exceeded for template creation',
      );
      throw new BadRequestException(
        'Too many template creations. Please wait before creating another template.',
      );
    }

    this.logger.debug(
      { userId, recentCount, maxAllowed: 3 },
      'Rate limit check passed for template creation',
    );
  }

  async createFromOnboarding(
    onboardingData: BudgetTemplateCreateFromOnboarding,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateCreateResponse> {
    try {
      // Enhanced logging for onboarding template creation
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

      // Rate limiting check - prevent abuse by checking recent template creation
      await this.checkOnboardingRateLimit(user.id, supabase);

      const validationResult =
        budgetTemplateCreateFromOnboardingSchema.safeParse(onboardingData);
      if (!validationResult.success) {
        this.logger.warn(
          { userId: user.id, validationErrors: validationResult.error.message },
          'Onboarding data validation failed',
        );
        throw new BadRequestException(
          `Invalid onboarding data: ${validationResult.error.message}`,
        );
      }

      const lines = this.createOnboardingTemplateLines(onboardingData);

      // Debug: Log the lines being created
      this.logger.info(
        {
          userId: user.id,
          linesCount: lines.length,
          lines: lines.map((l) => ({
            name: l.name,
            kind: l.kind,
            recurrence: l.recurrence,
          })),
        },
        'Template lines created from onboarding',
      );

      const templateCreateDto: BudgetTemplateCreate = {
        name: onboardingData.name || 'Mois Standard',
        description: onboardingData.description,
        isDefault: onboardingData.isDefault,
        lines,
      };

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
}
