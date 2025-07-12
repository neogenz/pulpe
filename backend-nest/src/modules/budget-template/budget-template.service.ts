import { Tables } from '@/types/database.types';
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

  private validateCreateTemplateDto(
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

  private prepareTemplateData(
    templateData: Omit<BudgetTemplateCreate, 'lines'>,
    userId: string,
  ) {
    return {
      name: templateData.name,
      description: templateData.description || null,
      is_default: templateData.isDefault || false,
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  private async insertTemplate(
    templateData: ReturnType<typeof this.prepareTemplateData>,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'template'>> {
    const { data: templateDb, error } = await supabase
      .from('template')
      .insert(templateData)
      .select()
      .single();

    if (error) {
      this.logger.error({ err: error }, 'Failed to create budget template');
      throw new BadRequestException('Erreur lors de la création du template');
    }

    return templateDb;
  }

  async create(
    createTemplateDto: BudgetTemplateCreate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateCreateResponse> {
    try {
      this.validateCreateTemplateDto(createTemplateDto);

      const { lines, ...templateData } = createTemplateDto;

      if (templateData.isDefault) {
        await this.ensureOnlyOneDefault(supabase, user.id);
      }

      const templateDbData = this.prepareTemplateData(templateData, user.id);
      const templateDb = await this.insertTemplate(templateDbData, supabase);

      // Create template lines if provided
      const createdLines: Tables<'template_line'>[] = [];
      if (lines && lines.length > 0) {
        for (const line of lines) {
          const lineData = this.budgetTemplateMapper.toInsertLine(
            line,
            templateDb.id,
          );
          const { data: lineDb, error } = await supabase
            .from('template_line')
            .insert(lineData)
            .select()
            .single();

          if (error || !lineDb) {
            // If any line creation fails, delete the template and rollback
            await supabase.from('template').delete().eq('id', templateDb.id);
            this.logger.error(
              { err: error },
              'Failed to create template line, rolling back template creation',
            );
            throw new BadRequestException(
              "Erreur lors de la création d'une ligne du template",
            );
          }

          createdLines.push(lineDb);
        }
      }

      const apiData = this.budgetTemplateMapper.toApi(templateDb);
      if (!apiData) {
        throw new InternalServerErrorException(
          'Erreur lors de la validation du template créé',
        );
      }

      const mappedLines = createdLines.map(this.budgetTemplateMapper.toApiLine);

      return {
        success: true,
        data: {
          template: apiData,
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
  async createTemplateLine(
    templateId: string,
    createLineDto: TemplateLineCreateWithoutTemplateId,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineResponse> {
    try {
      // Validate input
      const validationResult = templateLineCreateSchema.safeParse({
        ...createLineDto,
        templateId,
      });
      if (!validationResult.success) {
        throw new BadRequestException(
          `Données invalides: ${validationResult.error.message}`,
        );
      }

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

      // Create template line
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

  async updateTemplateLine(
    templateId: string,
    lineId: string,
    updateLineDto: TemplateLineUpdate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineResponse> {
    try {
      // Validate input
      const validationResult =
        templateLineUpdateSchema.safeParse(updateLineDto);
      if (!validationResult.success) {
        throw new BadRequestException(
          `Données invalides: ${validationResult.error.message}`,
        );
      }

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

      // Update template line
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
}
