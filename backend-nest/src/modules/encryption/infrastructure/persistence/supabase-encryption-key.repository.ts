import { Injectable } from '@nestjs/common';
import { SupabaseService } from '@modules/supabase/supabase.service';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { EncryptionKeyRepositoryPort } from '../../domain/ports/encryption-key-repository.port';
import type {
  UserEncryptionKey,
  UserEncryptionSalt,
  VaultStatus,
} from '../../domain/encryption.entity';
import type {
  RekeyBudgetLineRpcPayload,
  RekeyMonthlyBudgetRpcPayload,
  RekeyPlanWithdrawalRpcPayload,
  RekeySavingsGoalRpcPayload,
  RekeyTemplateLineRpcPayload,
  RekeyTransactionRpcPayload,
} from './schemas/rpc-payload.schemas';

export interface RekeyRpcPayloads {
  budgetLines: RekeyBudgetLineRpcPayload[];
  transactions: RekeyTransactionRpcPayload[];
  templateLines: RekeyTemplateLineRpcPayload[];
  savingsGoals: RekeySavingsGoalRpcPayload[];
  monthlyBudgets: RekeyMonthlyBudgetRpcPayload[];
  planWithdrawals: RekeyPlanWithdrawalRpcPayload[];
}

@Injectable()
export class SupabaseEncryptionKeyRepository implements EncryptionKeyRepositoryPort {
  readonly #supabaseService: SupabaseService;

  constructor(supabaseService: SupabaseService) {
    this.#supabaseService = supabaseService;
  }

  async findSaltByUserId(userId: string): Promise<UserEncryptionSalt | null> {
    const supabase = this.#supabaseService.getServiceRoleClient();
    const { data, error } = await supabase
      .from('user_encryption_key')
      .select('salt, kdf_iterations, key_check')
      .eq('user_id', userId)
      .single();

    if (error) {
      // PGRST116 = "Searched for a single row but found 0 rows" (not found)
      if (error.code === 'PGRST116') return null;
      throw new BusinessException(
        ERROR_DEFINITIONS.ENCRYPTION_REPOSITORY_FAILURE,
        undefined,
        {
          userId,
          operation: 'findSaltByUserId',
          supabaseCode: error.code,
          supabaseMessage: error.message,
        },
        { cause: error },
      );
    }
    if (!data) return null;
    return data;
  }

  async upsertSalt(
    userId: string,
    saltHex: string,
    kdfIterations: number,
  ): Promise<void> {
    const supabase = this.#supabaseService.getServiceRoleClient();
    const { error } = await supabase.from('user_encryption_key').upsert(
      {
        user_id: userId,
        salt: saltHex,
        kdf_iterations: kdfIterations,
      },
      { onConflict: 'user_id', ignoreDuplicates: true },
    );

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.ENCRYPTION_REPOSITORY_FAILURE,
        undefined,
        {
          userId,
          operation: 'upsertSalt',
          supabaseCode: error.code,
          supabaseMessage: error.message,
        },
        { cause: error },
      );
    }
  }

  async findByUserId(userId: string): Promise<UserEncryptionKey | null> {
    const supabase = this.#supabaseService.getServiceRoleClient();
    const { data, error } = await supabase
      .from('user_encryption_key')
      .select('salt, kdf_iterations, wrapped_dek, key_check')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new BusinessException(
        ERROR_DEFINITIONS.ENCRYPTION_REPOSITORY_FAILURE,
        undefined,
        {
          userId,
          operation: 'findByUserId',
          supabaseCode: error.code,
          supabaseMessage: error.message,
        },
        { cause: error },
      );
    }
    return data ?? null;
  }

  async hasRecoveryKey(userId: string): Promise<boolean> {
    const supabase = this.#supabaseService.getServiceRoleClient();
    const { data, error } = await supabase
      .from('user_encryption_key')
      .select('wrapped_dek')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return false;
      throw new BusinessException(
        ERROR_DEFINITIONS.ENCRYPTION_REPOSITORY_FAILURE,
        undefined,
        {
          userId,
          operation: 'hasRecoveryKey',
          supabaseCode: error.code,
          supabaseMessage: error.message,
        },
        { cause: error },
      );
    }
    return !!data?.wrapped_dek;
  }

  async updateWrappedDEK(
    userId: string,
    wrappedDEK: string | null,
  ): Promise<void> {
    const supabase = this.#supabaseService.getServiceRoleClient();
    const { error } = await supabase
      .from('user_encryption_key')
      .update({ wrapped_dek: wrappedDEK })
      .eq('user_id', userId);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.ENCRYPTION_REPOSITORY_FAILURE,
        undefined,
        {
          userId,
          operation: 'updateWrappedDEK',
          supabaseCode: error.code,
          supabaseMessage: error.message,
        },
        { cause: error },
      );
    }
  }

  async getVaultStatus(userId: string): Promise<VaultStatus> {
    const supabase = this.#supabaseService.getServiceRoleClient();
    const { data, error } = await supabase
      .from('user_encryption_key')
      .select('key_check, wrapped_dek')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return {
          pinCodeConfigured: false,
          recoveryKeyConfigured: false,
          vaultCodeConfigured: false,
        };
      }
      throw new BusinessException(
        ERROR_DEFINITIONS.ENCRYPTION_REPOSITORY_FAILURE,
        undefined,
        {
          userId,
          operation: 'getVaultStatus',
          supabaseCode: error.code,
          supabaseMessage: error.message,
        },
        { cause: error },
      );
    }

    const pinCodeConfigured = data?.key_check != null;
    const recoveryKeyConfigured = data?.wrapped_dek != null;

    return {
      pinCodeConfigured,
      recoveryKeyConfigured,
      vaultCodeConfigured: pinCodeConfigured && recoveryKeyConfigured,
    };
  }

  async updateKeyCheckIfNull(userId: string, keyCheck: string): Promise<void> {
    const supabase = this.#supabaseService.getServiceRoleClient();
    const { error } = await supabase
      .from('user_encryption_key')
      .update({ key_check: keyCheck, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('key_check', null);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.ENCRYPTION_REPOSITORY_FAILURE,
        undefined,
        {
          userId,
          operation: 'updateKeyCheckIfNull',
          supabaseCode: error.code,
          supabaseMessage: error.message,
        },
        { cause: error },
      );
    }
  }

  async initializeVaultIfEmpty(
    userId: string,
    keyCheck: string,
    wrappedDEK: string,
  ): Promise<boolean> {
    const supabase = this.#supabaseService.getServiceRoleClient();
    const { data, error } = await supabase
      .from('user_encryption_key')
      .update({
        key_check: keyCheck,
        wrapped_dek: wrappedDEK,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .is('key_check', null)
      .is('wrapped_dek', null)
      .select('user_id')
      .maybeSingle();

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.ENCRYPTION_REPOSITORY_FAILURE,
        undefined,
        {
          userId,
          operation: 'initializeVaultIfEmpty',
          supabaseCode: error.code,
          supabaseMessage: error.message,
        },
        { cause: error },
      );
    }
    return data !== null;
  }

  /**
   * Re-encryption of every amount owned by the user, atomic with the new
   * `key_check`. Runs on the service-role client: the RPC is not executable by
   * `authenticated`, so a stolen JWT can neither call it nor write `key_check`
   * directly. Ownership is enforced inside the function by `p_user_id`.
   */
  async rekeyUserData(
    userId: string,
    payloads: RekeyRpcPayloads,
    keyCheck: string,
  ): Promise<void> {
    const supabase = this.#supabaseService.getServiceRoleClient();
    const { error } = await supabase.rpc(
      'rekey_user_encrypted_data_with_plan_withdrawals',
      {
        p_user_id: userId,
        p_plan_withdrawals: payloads.planWithdrawals,
        p_budget_lines: payloads.budgetLines,
        p_transactions: payloads.transactions,
        p_template_lines: payloads.templateLines,
        p_savings_goals: payloads.savingsGoals,
        p_monthly_budgets: payloads.monthlyBudgets,
        p_key_check: keyCheck,
      },
    );

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.ENCRYPTION_REKEY_FAILED,
        undefined,
        { userId, operation: 'rekey.rpc_failure' },
        { cause: error },
      );
    }
  }

  async updateWrappedDEKIfNull(
    userId: string,
    wrappedDEK: string,
  ): Promise<boolean> {
    const supabase = this.#supabaseService.getServiceRoleClient();
    const { data, error } = await supabase
      .from('user_encryption_key')
      .update({ wrapped_dek: wrappedDEK, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('wrapped_dek', null)
      .select('user_id')
      .maybeSingle();

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.ENCRYPTION_REPOSITORY_FAILURE,
        undefined,
        {
          userId,
          operation: 'updateWrappedDEKIfNull',
          supabaseCode: error.code,
          supabaseMessage: error.message,
        },
        { cause: error },
      );
    }
    return data !== null;
  }
}
