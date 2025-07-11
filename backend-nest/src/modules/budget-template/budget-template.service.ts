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
  type BudgetTemplateDeleteResponse,
  type BudgetTemplateListResponse,
  type BudgetTemplateResponse,
  type BudgetTemplateUpdate,
  TemplateLineListResponse,
  budgetTemplateCreateSchema as createBudgetTemplateSchema,
  budgetTemplateUpdateSchema as updateBudgetTemplateSchema,
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
    createTemplateDto: BudgetTemplateCreate,
    userId: string,
  ) {
    return {
      name: createTemplateDto.name,
      description: createTemplateDto.description || null,
      is_default: createTemplateDto.isDefault || false,
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
  ): Promise<BudgetTemplateResponse> {
    try {
      this.validateCreateTemplateDto(createTemplateDto);

      if (createTemplateDto.isDefault) {
        await this.ensureOnlyOneDefault(supabase, user.id);
      }

      const templateData = this.prepareTemplateData(createTemplateDto, user.id);
      const templateDb = await this.insertTemplate(templateData, supabase);

      const apiData = this.budgetTemplateMapper.toApi(templateDb);
      if (!apiData) {
        throw new InternalServerErrorException(
          'Erreur lors de la validation du template créé',
        );
      }

      return {
        success: true,
        data: apiData,
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
