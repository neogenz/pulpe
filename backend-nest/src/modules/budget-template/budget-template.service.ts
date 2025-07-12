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

  async findAll(
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateListResponse> {
    try {
      const { data: templatesDb, error } = await supabase
        .from('template')
        .select('*')
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
      this.logger.error({ err: error }, 'RPC function failed');
      throw new InternalServerErrorException(
        'Erreur lors de la création du template',
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
    _user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateResponse> {
    try {
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
    _user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateDeleteResponse> {
    try {
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
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineListResponse> {
    try {
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

  private async verifyTemplateExists(
    templateId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const { data: templateDb, error: templateError } = await supabase
      .from('template')
      .select('id')
      .eq('id', templateId)
      .single();

    if (templateError || !templateDb) {
      throw new NotFoundException('Template introuvable ou accès non autorisé');
    }
  }

  async createTemplateLine(
    templateId: string,
    createLineDto: TemplateLineCreateWithoutTemplateId,
    _user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineResponse> {
    try {
      this.validateTemplateLineInput(createLineDto, templateId);
      await this.verifyTemplateExists(templateId, supabase);

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
    _user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineResponse> {
    try {
      // Check if template exists and belongs to user
      const { data: templateDb, error: templateError } = await supabase
        .from('template')
        .select('id')
        .eq('id', templateId)
        .single();

      if (templateError || !templateDb) {
        throw new NotFoundException(
          'Template introuvable ou accès non autorisé',
        );
      }

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
    _user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineResponse> {
    try {
      this.validateTemplateLineUpdate(updateLineDto);
      await this.verifyTemplateExists(templateId, supabase);

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
    _user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineDeleteResponse> {
    try {
      // Check if template exists and belongs to user
      const { data: templateDb, error: templateError } = await supabase
        .from('template')
        .select('id')
        .eq('id', templateId)
        .single();

      if (templateError || !templateDb) {
        throw new NotFoundException(
          'Template introuvable ou accès non autorisé',
        );
      }

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
      kind: 'income' as const,
      description: 'Regular monthly income',
    },
    {
      field: 'housingCosts' as const,
      name: 'Housing Costs',
      kind: 'expense' as const,
      description: 'Rent, utilities, home insurance',
    },
    {
      field: 'healthInsurance' as const,
      name: 'Health Insurance',
      kind: 'expense' as const,
      description: 'Monthly health insurance premium',
    },
    {
      field: 'phonePlan' as const,
      name: 'Phone Plan',
      kind: 'expense' as const,
      description: 'Monthly mobile plan',
    },
    {
      field: 'transportCosts' as const,
      name: 'Transport Costs',
      kind: 'expense' as const,
      description: 'Public transport or vehicle expenses',
    },
    {
      field: 'leasingCredit' as const,
      name: 'Leasing/Credit',
      kind: 'expense' as const,
      description: 'Monthly credit or leasing payments',
    },
  ];

  private createLineFromOnboardingField(
    amount: number,
    name: string,
    kind: 'income' | 'expense',
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
      const validationResult =
        budgetTemplateCreateFromOnboardingSchema.safeParse(onboardingData);
      if (!validationResult.success) {
        throw new BadRequestException(
          `Invalid onboarding data: ${validationResult.error.message}`,
        );
      }

      const lines = this.createOnboardingTemplateLines(onboardingData);

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
