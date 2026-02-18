import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@modules/supabase/supabase.service';

interface UserEncryptionKeyRow {
  salt: string;
  kdf_iterations: number;
  key_check: string | null;
}

export interface UserEncryptionKeyFullRow extends UserEncryptionKeyRow {
  wrapped_dek: string | null;
  key_check: string | null;
}

@Injectable()
export class EncryptionKeyRepository {
  readonly #logger = new Logger(EncryptionKeyRepository.name);
  readonly #supabaseService: SupabaseService;

  constructor(supabaseService: SupabaseService) {
    this.#supabaseService = supabaseService;
  }

  async findSaltByUserId(userId: string): Promise<UserEncryptionKeyRow | null> {
    const supabase = this.#supabaseService.getServiceRoleClient();
    const { data, error } = await supabase
      .from('user_encryption_key')
      .select('salt, kdf_iterations, key_check')
      .eq('user_id', userId)
      .single();

    if (error) {
      // PGRST116 = "Searched for a single row but found 0 rows" (not found)
      if (error.code === 'PGRST116') return null;
      throw new Error(
        `Failed to fetch encryption key for user ${userId}: ${error.message}`,
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
      this.#logger.error('Failed to upsert user salt', {
        userId,
        error: error.message,
      });
      throw new Error(`Failed to create encryption salt for user ${userId}`);
    }
  }

  async findByUserId(userId: string): Promise<UserEncryptionKeyFullRow | null> {
    const supabase = this.#supabaseService.getServiceRoleClient();
    const { data, error } = await supabase
      .from('user_encryption_key')
      .select('salt, kdf_iterations, wrapped_dek, key_check')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(
        `Failed to fetch encryption key for user ${userId}: ${error.message}`,
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
      throw new Error(
        `Failed to check recovery key for user ${userId}: ${error.message}`,
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
      throw new Error(
        `Failed to update wrapped DEK for user ${userId}: ${error.message}`,
      );
    }
  }

  async hasVaultCode(userId: string): Promise<boolean> {
    const supabase = this.#supabaseService.getServiceRoleClient();
    const { data, error } = await supabase
      .from('user_encryption_key')
      .select('key_check, wrapped_dek')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return false;
      throw new Error(
        `Failed to check vault code for user ${userId}: ${error.message}`,
      );
    }
    return data?.key_check != null && data?.wrapped_dek != null;
  }

  async updateKeyCheck(userId: string, keyCheck: string): Promise<void> {
    const supabase = this.#supabaseService.getServiceRoleClient();
    const { error } = await supabase
      .from('user_encryption_key')
      .update({ key_check: keyCheck })
      .eq('user_id', userId);

    if (error) {
      throw new Error(
        `Failed to update key_check for user ${userId}: ${error.message}`,
      );
    }
  }
}
