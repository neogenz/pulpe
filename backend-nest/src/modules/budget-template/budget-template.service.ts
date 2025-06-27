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
  type BudgetTemplateUpdate,
  type BudgetTemplateResponse,
  type BudgetTemplateListResponse,
  type BudgetTemplateDeleteResponse,
  type TemplateTransactionListResponse,
} from '@pulpe/shared';
import {
  BudgetTemplateMapper,
  type BudgetTemplateDbEntity,
} from './budget-template.mapper';

@Injectable()
export class BudgetTemplateService {
  private readonly logger = new Logger(BudgetTemplateService.name);

  constructor(private readonly budgetTemplateMapper: BudgetTemplateMapper) {}

  async findAll(
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateListResponse> {
    try {
      // Récupère les templates publics (user_id = NULL) + templates de l'utilisateur
      // RLS policy s'occupera automatiquement du filtrage
      const { data: templatesDb, error } = await supabase
        .from('budget_templates')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error('Erreur récupération templates:', error);
        throw new InternalServerErrorException(
          'Erreur lors de la récupération des templates',
        );
      }

      const templates = this.budgetTemplateMapper.toApiList(templatesDb || []);

      return {
        success: true as const,
        data: templates,
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error('Erreur liste templates:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async create(
    createTemplateDto: BudgetTemplateCreate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateResponse> {
    try {
      const templateData = this.budgetTemplateMapper.toDbCreate(
        createTemplateDto,
        user.id,
      );

      const { data: templateDb, error } = await supabase
        .from('budget_templates')
        .insert(templateData)
        .select()
        .single();

      if (error) {
        this.logger.error('Erreur création template:', error);
        throw new BadRequestException('Erreur lors de la création du template');
      }

      const template = this.budgetTemplateMapper.toApi(
        templateDb as BudgetTemplateDbEntity,
      );

      return {
        success: true as const,
        data: template,
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

      const template = this.budgetTemplateMapper.toApi(
        templateDb as BudgetTemplateDbEntity,
      );

      return {
        success: true as const,
        data: template,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Erreur récupération template:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async update(
    id: string,
    updateTemplateDto: BudgetTemplateUpdate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetTemplateResponse> {
    try {
      const updateData = {
        ...this.budgetTemplateMapper.toDbUpdate(updateTemplateDto),
        updated_at: new Date().toISOString(),
      };

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

      const template = this.budgetTemplateMapper.toApi(
        templateDb as BudgetTemplateDbEntity,
      );

      return {
        success: true as const,
        data: template,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
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
        success: true as const,
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
    templateId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateTransactionListResponse> {
    try {
      await this.validateTemplateAccess(templateId, supabase);
      const transactionsDb = await this.fetchTemplateTransactions(
        templateId,
        supabase,
      );
      const transactions = this.transformTemplateTransactions(transactionsDb);

      return {
        success: true as const,
        data: transactions,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Erreur récupération transactions template:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  private async validateTemplateAccess(
    templateId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const { data: template, error: templateError } = await supabase
      .from('budget_templates')
      .select('id')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      throw new NotFoundException('Template introuvable ou accès non autorisé');
    }
  }

  private async fetchTemplateTransactions(
    templateId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<unknown[]> {
    const { data: transactionsDb, error } = await supabase
      .from('template_transactions')
      .select('*')
      .eq('template_id', templateId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('Erreur récupération transactions template:', error);
      throw new InternalServerErrorException(
        'Erreur lors de la récupération des transactions du template',
      );
    }

    return transactionsDb || [];
  }

  private transformTemplateTransactions(transactionsDb: unknown[]): Array<{
    id: string;
    createdAt: string;
    updatedAt: string;
    templateId: string;
    amount: number;
    type: 'expense' | 'income' | 'saving';
    expenseType: 'fixed' | 'variable';
    name: string;
    description: string;
  }> {
    return (
      transactionsDb as Array<{
        id: string;
        created_at: string;
        updated_at: string;
        template_id: unknown;
        amount: unknown;
        type: unknown;
        expense_type: unknown;
        name: unknown;
        description: unknown;
        [key: string]: unknown;
      }>
    ).map((transaction) => ({
      id: transaction.id,
      createdAt: transaction.created_at,
      updatedAt: transaction.updated_at,
      templateId: String(transaction.template_id ?? ''),
      amount: Number(transaction.amount ?? 0),
      type: (transaction.type as 'expense' | 'income' | 'saving') ?? 'expense',
      expenseType:
        (transaction.expense_type as 'fixed' | 'variable') ?? 'fixed',
      name: String(transaction.name ?? ''),
      description: String(transaction.description ?? ''),
    }));
  }
}
