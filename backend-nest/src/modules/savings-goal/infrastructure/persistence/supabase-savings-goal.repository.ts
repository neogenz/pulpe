import { Inject, Injectable } from '@nestjs/common';
import type { Buffer } from 'node:buffer';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { mapCurrencyNonAmountMetadataToDb } from '@common/utils/currency-metadata.mapper';
import type { SavingsGoalRepositoryPort } from '../../domain/ports/savings-goal-repository.port';
import type {
  SavingsGoal,
  SavingsGoalCreateInput,
  SavingsGoalInsert,
  SavingsGoalRow,
  SavingsGoalUpdatePatch,
} from '../../domain/savings-goal.entity';

@Injectable()
export class SupabaseSavingsGoalRepository implements SavingsGoalRepositoryPort {
  constructor(
    private readonly supabaseProvider: AuthenticatedSupabaseProvider,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
  ) {}

  async findAll(): Promise<SavingsGoal[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('savings_goal')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_FETCH_FAILED,
        undefined,
        {
          operation: 'listSavingsGoals',
          entityType: 'savings_goal',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    if (!data?.length) return [];
    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return data.map((row) => this.toEntity(row, dek));
  }

  async findById(id: string): Promise<SavingsGoal> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('savings_goal')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_NOT_FOUND,
        { id },
        {
          operation: 'getSavingsGoal',
          entityId: id,
          entityType: 'savings_goal',
          supabaseError: error,
        },
      );
    }

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return this.toEntity(data, dek);
  }

  async insert(input: SavingsGoalCreateInput): Promise<SavingsGoal> {
    const supabase = this.supabaseProvider.client;
    const user = this.supabaseProvider.user;
    const row = await this.toInsertRow(input, user);

    const { data, error } = await supabase
      .from('savings_goal')
      .insert(row)
      .select('*')
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_CREATE_FAILED,
        undefined,
        {
          operation: 'createSavingsGoal',
          entityType: 'savings_goal',
          userId: user.id,
          supabaseError: error,
        },
        { cause: error ?? undefined },
      );
    }

    const dek = await this.encryption.getDekFor(user);
    return this.toEntity(data, dek);
  }

  async update(
    id: string,
    patch: SavingsGoalUpdatePatch,
  ): Promise<SavingsGoal> {
    const supabase = this.supabaseProvider.client;
    const user = this.supabaseProvider.user;
    const updateRow = await this.toUpdateRow(patch, user);

    const { data, error } = await supabase
      .from('savings_goal')
      .update(updateRow)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_UPDATE_FAILED,
        { id },
        {
          operation: 'updateSavingsGoal',
          entityId: id,
          entityType: 'savings_goal',
          userId: user.id,
          supabaseError: error,
        },
        { cause: error },
      );
    }

    if (!data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_NOT_FOUND,
        { id },
        {
          operation: 'updateSavingsGoal',
          entityId: id,
          entityType: 'savings_goal',
          userId: user.id,
        },
      );
    }

    const dek = await this.encryption.getDekFor(user);
    return this.toEntity(data, dek);
  }

  async delete(id: string): Promise<void> {
    const supabase = this.supabaseProvider.client;
    // FK budget_line/template_line.savings_goal_id ON DELETE SET NULL unlinks
    // the tagged lines atomically — no line is ever deleted.
    const { error } = await supabase.from('savings_goal').delete().eq('id', id);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_DELETE_FAILED,
        { id },
        {
          operation: 'deleteSavingsGoal',
          entityId: id,
          entityType: 'savings_goal',
          supabaseError: error,
        },
        { cause: error },
      );
    }
  }

  private toEntity(row: SavingsGoalRow, dek: Buffer): SavingsGoal {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      targetAmount: row.target_amount
        ? this.encryption.tryDecryptAmount(row.target_amount, dek, 0)
        : 0,
      targetDate: row.target_date,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      originalTargetAmount: row.original_target_amount
        ? this.encryption.tryDecryptAmount(
            row.original_target_amount,
            dek,
            null,
          )
        : null,
      originalCurrency: row.original_currency,
      targetCurrency: row.target_currency,
      exchangeRate: row.exchange_rate,
    };
  }

  private async toInsertRow(
    input: SavingsGoalCreateInput,
    user: AuthenticatedUser,
  ): Promise<SavingsGoalInsert> {
    const dek = await this.encryption.getDekFor(user);
    const targetAmount = this.encryption.encryptAmount(input.targetAmount, dek);
    const originalTargetAmount = await this.encryption.encryptOptionalAmount(
      input.originalTargetAmount,
      user.id,
      user.clientKey,
    );

    return {
      user_id: user.id,
      name: input.name,
      target_amount: targetAmount,
      original_target_amount: originalTargetAmount,
      target_date: input.targetDate,
      status: input.status,
      ...mapCurrencyNonAmountMetadataToDb(
        {
          originalCurrency: input.originalCurrency,
          targetCurrency: input.targetCurrency,
          exchangeRate: input.exchangeRate,
        },
        { userId: user.id },
      ),
    };
  }

  private async toUpdateRow(
    patch: SavingsGoalUpdatePatch,
    user: AuthenticatedUser,
  ): Promise<Partial<SavingsGoalInsert>> {
    const updateData: Partial<SavingsGoalInsert> = {};
    if (patch.name !== undefined) updateData.name = patch.name;
    if (patch.targetDate !== undefined)
      updateData.target_date = patch.targetDate;
    if (patch.status !== undefined) updateData.status = patch.status;

    if (patch.targetAmount !== undefined) {
      const dek = await this.encryption.getDekFor(user);
      updateData.target_amount = this.encryption.encryptAmount(
        patch.targetAmount,
        dek,
      );
    }

    if (patch.originalTargetAmount !== undefined) {
      updateData.original_target_amount =
        await this.encryption.encryptOptionalAmount(
          patch.originalTargetAmount,
          user.id,
          user.clientKey,
        );
    }

    Object.assign(
      updateData,
      mapCurrencyNonAmountMetadataToDb(
        {
          originalCurrency: patch.originalCurrency,
          targetCurrency: patch.targetCurrency,
          exchangeRate: patch.exchangeRate,
        },
        { userId: user.id },
      ),
    );

    return updateData;
  }
}
