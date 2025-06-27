import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  type BudgetTemplateCreate,
  type BudgetTemplateDeleteResponse,
  type BudgetTemplateListResponse,
  type BudgetTemplateResponse,
  type BudgetTemplateUpdate,
  type TemplateTransactionListResponse,
  budgetTemplateCreateSchema as createBudgetTemplateSchema,
  budgetTemplateUpdateSchema as updateBudgetTemplateSchema,
} from '@pulpe/shared';
import { type BudgetTemplateRow } from './entities';
import { BudgetTemplateMapper } from './budget-template.mapper';

interface TemplateTransactionDb {
  id: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  type: 'expense' | 'income' | 'saving';
  amount: number;
  name: string;
  expense_type: 'fixed' | 'variable';
  template_id: string;
}

@Injectable()
export class BudgetTemplateService {
  private readonly logger = new Logger(BudgetTemplateService.name);

  constructor(private readonly budgetTemplateMapper: BudgetTemplateMapper) {}

  async findAll(
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateListResponse> {
    try {
      const { data: templatesDb, error } = await supabase
        .from('budget_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error('Erreur récupération templates:', error);
        throw new InternalServerErrorException(
          'Erreur lors de la récupération des templates',
        );
      }

      const templates = this.validateAndEnrichTemplates(templatesDb || []);
      const apiData = this.budgetTemplateMapper.toApiList(templates);

      return {
        success: true as const,
        data: apiData,
      } as BudgetTemplateListResponse;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error('Erreur liste templates:', error);
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
      category: createTemplateDto.category || null,
      is_default: createTemplateDto.isDefault || false,
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  private async insertTemplate(
    templateData: ReturnType<typeof this.prepareTemplateData>,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<unknown> {
    const { data: templateDb, error } = await supabase
      .from('budget_templates')
      .insert(templateData)
      .select()
      .single();

    if (error) {
      this.logger.error('Erreur création template:', error);
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

      const template = this.validateAndEnrichTemplate(templateDb);
      if (!template) {
        throw new InternalServerErrorException(
          'Erreur lors de la validation du template créé',
        );
      }

      const apiData = this.budgetTemplateMapper.toApi(template);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Erreur création template:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateResponse> {
    try {
      const { data: templateDb, error } = await supabase
        .from('budget_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !templateDb) {
        throw new NotFoundException(
          'Template introuvable ou accès non autorisé',
        );
      }

      const template = this.validateAndEnrichTemplate(templateDb);
      if (!template) {
        throw new NotFoundException(
          'Template introuvable ou données invalides',
        );
      }

      const apiData = this.budgetTemplateMapper.toApi(template);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Erreur récupération template:', error);
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
      ...(updateTemplateDto.category !== undefined && {
        category: updateTemplateDto.category,
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
  ): Promise<unknown> {
    const { data: templateDb, error } = await supabase
      .from('budget_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !templateDb) {
      this.logger.error('Erreur modification template:', error);
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

      const template = this.validateAndEnrichTemplate(templateDb);
      if (!template) {
        throw new InternalServerErrorException(
          'Erreur lors de la validation du template modifié',
        );
      }

      const apiData = this.budgetTemplateMapper.toApi(template);

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
      this.logger.error('Erreur modification template:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async remove(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateDeleteResponse> {
    try {
      const { error } = await supabase
        .from('budget_templates')
        .delete()
        .eq('id', id);

      if (error) {
        this.logger.error('Erreur suppression template:', error);
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
      this.logger.error('Erreur suppression template:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async findTemplateTransactions(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateTransactionListResponse> {
    try {
      const { data: templateTransactionsDb, error } = await supabase
        .from('template_transactions')
        .select('*')
        .eq('template_id', id)
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error('Erreur récupération transactions template:', error);
        throw new InternalServerErrorException(
          'Erreur lors de la récupération des transactions du template',
        );
      }

      const mappedTransactions = (templateTransactionsDb || []).map(
        (transaction: TemplateTransactionDb) => ({
          id: transaction.id,
          description: transaction.description || '',
          createdAt: transaction.created_at,
          updatedAt: transaction.updated_at,
          type: transaction.type,
          amount: transaction.amount,
          name: transaction.name,
          expenseType: transaction.expense_type,
          templateId: transaction.template_id,
        }),
      );

      return {
        success: true as const,
        data: mappedTransactions,
      } as TemplateTransactionListResponse;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error('Erreur liste transactions template:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  private validateAndEnrichTemplates(
    rawTemplates: unknown[],
  ): EnrichedBudgetTemplate[] {
    return rawTemplates
      .map(this.validateAndEnrichTemplate.bind(this))
      .filter(
        (template): template is EnrichedBudgetTemplate => template !== null,
      )
      .sort((a, b) => {
        if (a.is_default && !b.is_default) return -1;
        if (!a.is_default && b.is_default) return 1;
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
  }

  private validateAndEnrichTemplate(
    rawTemplate: unknown,
  ): EnrichedBudgetTemplate | null {
    if (!this.isValidBudgetTemplateRow(rawTemplate)) {
      this.logger.warn('Template invalide ignoré:', rawTemplate);
      return null;
    }

    return {
      ...rawTemplate,
      displayCategory: this.formatCategory(rawTemplate),
      isUserDefault: rawTemplate.is_default,
    };
  }

  private isValidBudgetTemplateRow(data: unknown): data is BudgetTemplateRow {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const template = data as Record<string, unknown>;

    return (
      typeof template.id === 'string' &&
      typeof template.name === 'string' &&
      typeof template.is_default === 'boolean' &&
      typeof template.created_at === 'string' &&
      typeof template.updated_at === 'string' &&
      (template.description === null ||
        typeof template.description === 'string') &&
      (template.category === null || typeof template.category === 'string') &&
      (template.user_id === null || typeof template.user_id === 'string')
    );
  }

  private async ensureOnlyOneDefault(
    supabase: AuthenticatedSupabaseClient,
    userId: string,
    excludeId?: string,
  ): Promise<void> {
    const { error } = await supabase
      .from('budget_templates')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true)
      .neq('id', excludeId || '');

    if (error) {
      this.logger.error('Erreur désactivation templates par défaut:', error);
      throw new InternalServerErrorException(
        'Erreur lors de la gestion des templates par défaut',
      );
    }
  }

  private formatCategory(template: BudgetTemplateRow): string {
    if (!template.category) return 'Sans catégorie';

    const categories = {
      personal: 'Personnel',
      family: 'Famille',
      business: 'Professionnel',
      student: 'Étudiant',
      retirement: 'Retraite',
      emergency: 'Urgence',
      custom: 'Personnalisé',
    };

    return (
      categories[template.category as keyof typeof categories] ||
      template.category
    );
  }
}

type EnrichedBudgetTemplate = BudgetTemplateRow & {
  displayCategory: string;
  isUserDefault: boolean;
};
