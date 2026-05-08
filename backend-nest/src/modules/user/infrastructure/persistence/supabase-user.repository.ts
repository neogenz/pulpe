import { Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import { SupabaseService } from '@modules/supabase/supabase.service';
import {
  type SupportedCurrency,
  payDayOfMonthSchema,
  supportedCurrencySchema,
} from 'pulpe-shared';
import type {
  UpdateUserProfileInput,
  UpdateUserSettingsInput,
  UserProfile,
  UserSettings,
} from '../../domain/user.entity';
import type { UserRepositoryPort } from '../../domain/ports/user-repository.port';

const DEFAULT_CURRENCY: SupportedCurrency = 'CHF';

interface SupabaseUserMetadata {
  firstName?: string;
  lastName?: string;
  payDayOfMonth?: number | null;
  currency?: string;
  showCurrencySelector?: boolean;
  scheduledDeletionAt?: string;
}

interface SupabaseUserShape {
  id: string;
  email?: string;
  user_metadata?: SupabaseUserMetadata;
}

@Injectable()
export class SupabaseUserRepository implements UserRepositoryPort {
  constructor(
    private readonly authenticatedProvider: AuthenticatedSupabaseProvider,
    private readonly supabaseService: SupabaseService,
    @InjectInfoLogger(SupabaseUserRepository.name)
    private readonly logger: InfoLogger,
  ) {}

  /**
   * Profile updates use the JWT-scoped client because the user is mutating
   * their own metadata via `supabase.auth.updateUser()`.
   */
  async updateProfile(input: UpdateUserProfileInput): Promise<UserProfile> {
    const supabase = this.authenticatedProvider.client;
    const { data, error } = await supabase.auth.updateUser({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
      },
    });

    if (error || !data.user) {
      throw new BusinessException(
        ERROR_DEFINITIONS.USER_PROFILE_UPDATE_FAILED,
        undefined,
        { operation: 'user.updateProfile' },
        { cause: error },
      );
    }

    return this.#toUserProfile(data.user as SupabaseUserShape);
  }

  /**
   * Settings reads use the JWT-scoped client (`auth.getUser()` returns the
   * current user's metadata).
   */
  async findSettings(): Promise<UserSettings> {
    const supabase = this.authenticatedProvider.client;
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      throw new BusinessException(
        ERROR_DEFINITIONS.USER_FETCH_FAILED,
        undefined,
        { operation: 'user.findSettings' },
        { cause: error },
      );
    }

    return this.#toUserSettings((data.user as SupabaseUserShape).user_metadata);
  }

  /**
   * Settings writes go through the service-role admin API so the full
   * `user_metadata` object can be replaced atomically (preserving keys the
   * caller did not patch). The current metadata is fetched via the
   * authenticated client first.
   */
  async updateSettings(
    userId: string,
    patch: UpdateUserSettingsInput,
  ): Promise<UserSettings> {
    const currentMetadata = await this.#fetchCurrentMetadata();
    const merged: SupabaseUserMetadata = {
      ...currentMetadata,
      ...(patch.payDayOfMonth !== undefined && {
        payDayOfMonth: patch.payDayOfMonth,
      }),
      ...(patch.currency !== undefined && { currency: patch.currency }),
      ...(patch.showCurrencySelector !== undefined && {
        showCurrencySelector: patch.showCurrencySelector,
      }),
    };

    const serviceClient = this.supabaseService.getServiceRoleClient();
    const { data, error } = await serviceClient.auth.admin.updateUserById(
      userId,
      { user_metadata: merged },
    );

    if (error || !data.user) {
      throw new BusinessException(
        ERROR_DEFINITIONS.USER_SETTINGS_UPDATE_FAILED,
        undefined,
        { operation: 'user.updateSettings', userId },
        { cause: error },
      );
    }

    return this.#toUserSettings((data.user as SupabaseUserShape).user_metadata);
  }

  /**
   * Schedule deletion via the service-role admin API. Idempotent: if the user
   * already has `scheduledDeletionAt`, returns it without writing.
   */
  async scheduleDeletion(
    userId: string,
  ): Promise<{ scheduledDeletionAt: string; alreadyScheduled: boolean }> {
    const currentMetadata = await this.#fetchCurrentMetadata();
    const existing = currentMetadata.scheduledDeletionAt;
    if (typeof existing === 'string' && existing.length > 0) {
      return { scheduledDeletionAt: existing, alreadyScheduled: true };
    }

    const serviceClient = this.supabaseService.getServiceRoleClient();
    const scheduledDeletionAt = new Date().toISOString();
    const { error } = await serviceClient.auth.admin.updateUserById(userId, {
      user_metadata: { ...currentMetadata, scheduledDeletionAt },
    });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.USER_ACCOUNT_DELETION_FAILED,
        undefined,
        { operation: 'user.scheduleDeletion', userId },
        { cause: error },
      );
    }

    return { scheduledDeletionAt, alreadyScheduled: false };
  }

  /**
   * Service-role admin call to invalidate every active session bound to the
   * provided access token (`'global'` scope).
   */
  async signOutGlobally(accessToken: string): Promise<void> {
    const serviceClient = this.supabaseService.getServiceRoleClient();
    const { error } = await serviceClient.auth.admin.signOut(
      accessToken,
      'global',
    );

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.USER_ACCOUNT_DELETION_FAILED,
        undefined,
        { operation: 'user.signOutGlobally' },
        { cause: error },
      );
    }
  }

  async #fetchCurrentMetadata(): Promise<SupabaseUserMetadata> {
    const supabase = this.authenticatedProvider.client;
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      throw new BusinessException(
        ERROR_DEFINITIONS.USER_FETCH_FAILED,
        undefined,
        { operation: 'user.fetchCurrentMetadata' },
        { cause: error },
      );
    }

    return (data.user as SupabaseUserShape).user_metadata ?? {};
  }

  #toUserProfile(user: SupabaseUserShape): UserProfile {
    return {
      id: user.id,
      email: user.email ?? '',
      ...(user.user_metadata?.firstName && {
        firstName: user.user_metadata.firstName,
      }),
      ...(user.user_metadata?.lastName && {
        lastName: user.user_metadata.lastName,
      }),
    };
  }

  #toUserSettings(metadata: SupabaseUserMetadata | undefined): UserSettings {
    const rawPayDay = metadata?.payDayOfMonth;
    const parsedPayDay = payDayOfMonthSchema.safeParse(rawPayDay);
    const payDayOfMonth = parsedPayDay.success
      ? (parsedPayDay.data ?? null)
      : null;

    const rawCurrency = metadata?.currency;
    const parsedCurrency = supportedCurrencySchema.safeParse(rawCurrency);
    const currency = parsedCurrency.success
      ? parsedCurrency.data
      : DEFAULT_CURRENCY;

    if (!parsedCurrency.success && rawCurrency !== undefined) {
      this.logger.warn(
        { rawCurrency },
        'Invalid currency in user_metadata, falling back to default',
      );
    }

    return {
      payDayOfMonth,
      currency,
      showCurrencySelector: metadata?.showCurrencySelector === true,
    };
  }
}
