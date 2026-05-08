import { Inject, Injectable } from '@nestjs/common';
import type { Buffer } from 'node:buffer';
import { ZodError } from 'zod';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { mapCurrencyMetadataToDb } from '@common/utils/currency-metadata.mapper';
import type {
  BudgetTemplate,
  BudgetTemplateUpdatePatch,
  BulkTemplateLineOperationsInput,
  CreateTemplateWithLinesInput,
  MonthlyBudgetRow,
  TemplateLine,
  TemplateLineCreateInput,
  TemplateLineInsert,
  TemplateLineRow,
  TemplateLineRpcInput,
  TemplateLineRpcUpdate,
  TemplateLineUpdatePatch,
  TemplateRow,
  TemplateUsageBudget,
} from '../../domain/budget-template.entity';
import type {
  BudgetTemplateRepositoryPort,
  BulkTemplateLineOperationsResult,
} from '../../domain/ports/budget-template-repository.port';
import {
  applyTemplateLineOperationsListSchema,
  createTemplateLinesRpcPayloadSchema,
} from './schemas/rpc-payload.schemas';

@Injectable()
export class SupabaseBudgetTemplateRepository implements BudgetTemplateRepositoryPort {
  constructor(
    private readonly supabaseProvider: AuthenticatedSupabaseProvider,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
  ) {}

  async findAllForUser(userId: string): Promise<BudgetTemplate[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('template')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_FETCH_FAILED,
        undefined,
        { operation: 'findAllForUser', userId },
        { cause: error },
      );
    }

    return (data ?? []).map((row) => this.toTemplateEntity(row));
  }

  async findById(id: string, userId: string): Promise<BudgetTemplate> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('template')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_NOT_FOUND,
        { id },
        { operation: 'findById', userId, entityId: id },
      );
    }

    return this.toTemplateEntity(data);
  }

  async validateAccess(id: string, userId: string): Promise<BudgetTemplate> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('template')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new BusinessException(ERROR_DEFINITIONS.TEMPLATE_NOT_FOUND, {
        id,
      });
    }

    if (data.user_id !== userId) {
      throw new BusinessException(ERROR_DEFINITIONS.TEMPLATE_ACCESS_FORBIDDEN, {
        id,
      });
    }

    return this.toTemplateEntity(data);
  }

  async countForUser(userId: string): Promise<number> {
    const supabase = this.supabaseProvider.client;
    const { count, error } = await supabase
      .from('template')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_FETCH_FAILED,
        undefined,
        { operation: 'countForUser', userId },
        { cause: error },
      );
    }

    return count ?? 0;
  }

  async resetDefaultTemplates(
    userId: string,
    exceptId: string | null,
  ): Promise<void> {
    const supabase = this.supabaseProvider.client;
    let query = supabase
      .from('template')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true);

    if (exceptId) {
      query = query.neq('id', exceptId);
    }

    await query;
  }

  async update(
    id: string,
    patch: BudgetTemplateUpdatePatch,
  ): Promise<BudgetTemplate> {
    const supabase = this.supabaseProvider.client;
    const updateData: Partial<TemplateRow> = {};
    if (patch.name !== undefined) updateData.name = patch.name;
    if (patch.description !== undefined) {
      updateData.description = patch.description ?? null;
    }
    if (patch.isDefault !== undefined) updateData.is_default = patch.isDefault;

    const { data: result, error } = await supabase
      .from('template')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !result) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_NOT_FOUND,
        { id },
        { operation: 'update', entityId: id },
        { cause: error ?? undefined },
      );
    }

    return this.toTemplateEntity(result);
  }

  async delete(id: string): Promise<void> {
    const supabase = this.supabaseProvider.client;
    const { error } = await supabase.from('template').delete().eq('id', id);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_NOT_FOUND,
        { id },
        { operation: 'delete', entityId: id },
        { cause: error },
      );
    }
  }

  async findLinesByTemplateId(templateId: string): Promise<TemplateLine[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('template_line')
      .select('*')
      .eq('template_id', templateId)
      .order('name', { ascending: true });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_FETCH_FAILED,
        undefined,
        { operation: 'findLinesByTemplateId', entityId: templateId },
        { cause: error },
      );
    }

    if (!data?.length) return [];
    const dek = await this.getDek();
    return data.map((row) => this.toTemplateLine(row, dek));
  }

  async insertLine(input: TemplateLineCreateInput): Promise<TemplateLine> {
    const supabase = this.supabaseProvider.client;
    const user = this.supabaseProvider.user;

    const insertRow = await this.toTemplateLineInsertRow(input, user);

    const { data, error } = await supabase
      .from('template_line')
      .insert(insertRow)
      .select()
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_CREATE_FAILED,
        undefined,
        { operation: 'insertLine' },
        { cause: error ?? undefined },
      );
    }

    const dek = await this.getDek();
    return this.toTemplateLine(data, dek);
  }

  async findLineById(
    lineId: string,
  ): Promise<{ line: TemplateLine; templateUserId: string | null }> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('template_line')
      .select('*, template!inner(user_id)')
      .eq('id', lineId)
      .single();

    if (error || !data) {
      throw new BusinessException(ERROR_DEFINITIONS.TEMPLATE_LINE_NOT_FOUND, {
        id: lineId,
      });
    }

    const row = data as TemplateLineRow & {
      template: { user_id: string | null };
    };

    const dek = await this.getDek();
    return {
      line: this.toTemplateLine(row, dek),
      templateUserId: row.template.user_id,
    };
  }

  async validateLineAccess(
    lineId: string,
    userId: string,
  ): Promise<TemplateLine> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('template_line')
      .select('*, template!inner(user_id)')
      .eq('id', lineId)
      .single();

    if (error || !data) {
      throw new BusinessException(ERROR_DEFINITIONS.TEMPLATE_LINE_NOT_FOUND, {
        id: lineId,
      });
    }

    const row = data as TemplateLineRow & {
      template: { user_id: string | null };
    };

    if (row.template.user_id !== userId) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_LINE_ACCESS_FORBIDDEN,
        { id: lineId },
      );
    }

    const dek = await this.getDek();
    return this.toTemplateLine(row, dek);
  }

  async updateLine(
    lineId: string,
    patch: TemplateLineUpdatePatch,
  ): Promise<TemplateLine> {
    const supabase = this.supabaseProvider.client;
    const user = this.supabaseProvider.user;

    const updateRow = await this.toTemplateLineUpdateRow(patch, user);

    const { data, error } = await supabase
      .from('template_line')
      .update(updateRow)
      .eq('id', lineId)
      .select()
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_LINE_NOT_FOUND,
        { id: lineId },
        { operation: 'updateLine', entityId: lineId },
        { cause: error ?? undefined },
      );
    }

    const dek = await this.getDek();
    return this.toTemplateLine(data, dek);
  }

  async deleteLine(lineId: string): Promise<void> {
    const supabase = this.supabaseProvider.client;
    const { error } = await supabase
      .from('template_line')
      .delete()
      .eq('id', lineId);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_LINE_NOT_FOUND,
        { id: lineId },
        { operation: 'deleteLine', entityId: lineId },
        { cause: error },
      );
    }
  }

  async isTemplateInUse(templateId: string): Promise<boolean> {
    const supabase = this.supabaseProvider.client;
    const { data } = await supabase
      .from('monthly_budget')
      .select('id')
      .eq('template_id', templateId)
      .limit(1);

    return (data?.length ?? 0) > 0;
  }

  async fetchTemplateBudgets(
    templateId: string,
  ): Promise<TemplateUsageBudget[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('id, month, year, description')
      .eq('template_id', templateId)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        undefined,
        { operation: 'fetchTemplateBudgets', entityId: templateId },
        { cause: error },
      );
    }

    return (data ?? []) as TemplateUsageBudget[];
  }

  async countOnboardingTemplatesInWindow(
    userId: string,
    sinceIso: string,
  ): Promise<number> {
    const supabase = this.supabaseProvider.client;
    const { data } = await supabase
      .from('template')
      .select('id')
      .eq('user_id', userId)
      .eq('is_from_onboarding', true)
      .gte('created_at', sinceIso);

    return data?.length ?? 0;
  }

  async validateLinesExist(
    templateId: string,
    lineIds: string[],
  ): Promise<string[]> {
    if (!lineIds.length) return [];

    const supabase = this.supabaseProvider.client;
    const { data } = await supabase
      .from('template_line')
      .select('id')
      .eq('template_id', templateId)
      .in('id', lineIds);

    if (!data || data.length !== lineIds.length) {
      throw new BusinessException(ERROR_DEFINITIONS.TEMPLATE_LINE_NOT_FOUND);
    }

    return data.map((row) => row.id);
  }

  async fetchFutureBudgets(
    templateId: string,
    userId: string,
    currentPeriod: { year: number; month: number },
  ): Promise<Pick<MonthlyBudgetRow, 'id' | 'month' | 'year'>[]> {
    const supabase = this.supabaseProvider.client;
    const { year, month } = currentPeriod;
    const futureFilter = `year.gt.${year},and(year.eq.${year},month.gte.${month})`;

    const { data, error } = await supabase
      .from('monthly_budget')
      .select('id, month, year')
      .eq('template_id', templateId)
      .eq('user_id', userId)
      .or(futureFilter);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        undefined,
        { operation: 'fetchFutureBudgets', entityId: templateId },
        { cause: error },
      );
    }

    return (data ?? []) as Pick<MonthlyBudgetRow, 'id' | 'month' | 'year'>[];
  }

  async fetchAllBudgetsForTemplate(
    templateId: string,
    userId: string,
  ): Promise<MonthlyBudgetRow[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('*')
      .eq('template_id', templateId)
      .eq('user_id', userId);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        undefined,
        { operation: 'fetchAllBudgetsForTemplate', entityId: templateId },
        { cause: error },
      );
    }

    return data ?? [];
  }

  async createTemplateWithLines(
    input: CreateTemplateWithLinesInput,
  ): Promise<BudgetTemplate> {
    const supabase = this.supabaseProvider.client;
    const user = this.supabaseProvider.user;

    const rpcLines = await this.encryptLinesForCreateRpc(input.lines, user);
    const validated = this.parseRpcPayload(
      createTemplateLinesRpcPayloadSchema,
      rpcLines,
      'createTemplateWithLines',
    );

    const { data, error } = await supabase.rpc('create_template_with_lines', {
      p_user_id: input.userId,
      p_name: input.name,
      p_description: input.description,
      p_is_default: input.isDefault,
      p_lines: validated as never,
    });

    if (error) throw error;

    if (!data) {
      throw new BusinessException(ERROR_DEFINITIONS.TEMPLATE_CREATE_FAILED);
    }

    return this.toTemplateEntity(data as unknown as TemplateRow);
  }

  async bulkApplyTemplateLineOperations(
    input: BulkTemplateLineOperationsInput,
  ): Promise<BulkTemplateLineOperationsResult> {
    const supabase = this.supabaseProvider.client;
    const user = this.supabaseProvider.user;

    const hasBudgetMutations = input.budgetIds.length > 0;
    const updatedLinesRpc =
      hasBudgetMutations && input.updatedLines.length > 0
        ? await this.encryptLinesForApplyRpc(input.updatedLines, user)
        : [];
    const createdLinesRpc =
      hasBudgetMutations && input.createdLines.length > 0
        ? await this.encryptLinesForApplyRpc(input.createdLines, user)
        : [];

    const updatedLinesPayload = this.parseRpcPayload(
      applyTemplateLineOperationsListSchema,
      updatedLinesRpc,
      'bulkApplyTemplateLineOperations.updated',
    );
    const createdLinesPayload = this.parseRpcPayload(
      applyTemplateLineOperationsListSchema,
      createdLinesRpc,
      'bulkApplyTemplateLineOperations.created',
    );

    const { data, error } = await supabase.rpc(
      'apply_template_line_operations',
      {
        template_id: input.templateId,
        budget_ids: input.budgetIds,
        delete_ids: input.deleteIds,
        updated_lines: updatedLinesPayload as never,
        created_lines: createdLinesPayload as never,
      },
    );

    if (error) throw error;

    const affectedBudgetIds = Array.isArray(data)
      ? (data.filter((id): id is string => Boolean(id)) as string[])
      : [];

    return { affectedBudgetIds };
  }

  private async getDek(): Promise<Buffer> {
    const user = this.supabaseProvider.user;
    return this.encryption.getUserDEK(user.id, user.clientKey);
  }

  private toTemplateEntity(row: TemplateRow): BudgetTemplate {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      isDefault: row.is_default,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toTemplateLine(row: TemplateLineRow, dek: Buffer): TemplateLine {
    return {
      id: row.id,
      templateId: row.template_id,
      name: row.name,
      amount: row.amount
        ? this.encryption.tryDecryptAmount(row.amount, dek, 0)
        : 0,
      originalAmount: row.original_amount
        ? this.encryption.tryDecryptAmount(row.original_amount, dek, null)
        : null,
      originalCurrency:
        row.original_currency as TemplateLine['originalCurrency'],
      targetCurrency: row.target_currency as TemplateLine['targetCurrency'],
      exchangeRate: row.exchange_rate,
      kind: row.kind,
      recurrence: row.recurrence,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async toTemplateLineInsertRow(
    input: TemplateLineCreateInput,
    user: AuthenticatedUser,
  ): Promise<TemplateLineInsert> {
    const { amount: encryptedAmount } = await this.encryption.prepareAmountData(
      input.amount,
      user.id,
      user.clientKey,
    );
    const encryptedOriginalAmount = await this.encryption.encryptOptionalAmount(
      input.originalAmount,
      user.id,
      user.clientKey,
    );

    return {
      template_id: input.templateId,
      name: input.name,
      amount: encryptedAmount,
      original_amount: encryptedOriginalAmount,
      ...mapCurrencyMetadataToDb({
        originalCurrency: input.originalCurrency,
        targetCurrency: input.targetCurrency,
        exchangeRate: input.exchangeRate,
      }),
      kind: input.kind,
      recurrence: input.recurrence,
      description: input.description,
    };
  }

  private async toTemplateLineUpdateRow(
    patch: TemplateLineUpdatePatch,
    user: AuthenticatedUser,
  ): Promise<Partial<TemplateLineInsert>> {
    const updateData: Partial<TemplateLineInsert> = {};
    if (patch.name !== undefined) updateData.name = patch.name;
    if (patch.kind !== undefined) updateData.kind = patch.kind;
    if (patch.recurrence !== undefined)
      updateData.recurrence = patch.recurrence;
    if (patch.description !== undefined) {
      updateData.description = patch.description;
    }

    if (patch.amount !== undefined) {
      const { amount } = await this.encryption.prepareAmountData(
        patch.amount,
        user.id,
        user.clientKey,
      );
      updateData.amount = amount;
    }

    if (patch.originalAmount !== undefined) {
      updateData.original_amount = await this.encryption.encryptOptionalAmount(
        patch.originalAmount,
        user.id,
        user.clientKey,
      );
    }

    Object.assign(
      updateData,
      mapCurrencyMetadataToDb({
        originalCurrency: patch.originalCurrency,
        targetCurrency: patch.targetCurrency,
        exchangeRate: patch.exchangeRate,
      }),
    );

    return updateData;
  }

  private async encryptLinesForCreateRpc(
    lines: TemplateLineRpcInput[],
    user: AuthenticatedUser,
  ): Promise<unknown[]> {
    if (!lines.length) return [];
    const amounts = lines.map((line) => line.amount);
    const [preparedAmounts, encryptedOriginalAmounts] = await Promise.all([
      this.encryption.prepareAmountsData(amounts, user.id, user.clientKey),
      Promise.all(
        lines.map((line) =>
          this.encryption.encryptOptionalAmount(
            line.originalAmount,
            user.id,
            user.clientKey,
          ),
        ),
      ),
    ]);

    return lines.map((line, index) => ({
      name: line.name,
      amount: preparedAmounts[index].amount,
      kind: line.kind,
      recurrence: line.recurrence,
      description: line.description,
      original_amount: encryptedOriginalAmounts[index],
      original_currency: line.originalCurrency ?? null,
      target_currency: line.targetCurrency ?? null,
      exchange_rate: line.exchangeRate,
    }));
  }

  private async encryptLinesForApplyRpc(
    lines: TemplateLineRpcUpdate[],
    user: AuthenticatedUser,
  ): Promise<unknown[]> {
    if (!lines.length) return [];
    const dek = await this.encryption.ensureUserDEK(user.id, user.clientKey);

    const encryptedOriginalAmounts = await Promise.all(
      lines.map((line) =>
        this.encryption.encryptOptionalAmount(
          line.originalAmount,
          user.id,
          user.clientKey,
        ),
      ),
    );

    return lines.map((line, index) => ({
      id: line.id,
      name: line.name,
      amount:
        line.amount === null
          ? null
          : this.encryption.encryptAmount(line.amount, dek),
      kind: line.kind,
      recurrence: line.recurrence,
      original_amount: encryptedOriginalAmounts[index],
      original_currency: line.originalCurrency ?? null,
      target_currency: line.targetCurrency ?? null,
      exchange_rate: line.exchangeRate,
    }));
  }

  private parseRpcPayload<T>(
    schema: { parse: (data: unknown) => T },
    payload: unknown,
    operation: string,
  ): T {
    try {
      return schema.parse(payload);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BusinessException(
          ERROR_DEFINITIONS.TEMPLATE_CREATE_FAILED,
          { reason: 'Invalid RPC payload structure' },
          { operation, validationErrors: err.issues },
          { cause: err },
        );
      }
      throw err;
    }
  }
}
