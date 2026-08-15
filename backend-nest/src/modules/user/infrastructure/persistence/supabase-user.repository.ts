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
  supportedLocaleSchema,
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
  /** Read-only rollout fallback; new locale writes use user_locale_preference. */
  locale?: string;
}

interface SupabaseUserShape {
  id: string;
  email?: string;
  app_metadata?: unknown;
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

  /** Settings reads use only the current user's JWT-scoped client. */
  async findSettings(): Promise<UserSettings> {
    const user = await this.#fetchCurrentUser();
    const locale = await this.#findLocale(user);
    return this.#toUserSettings(user.user_metadata, locale);
  }

  /**
   * Legacy budget settings still use user_metadata. Locale is application
   * data and is upserted through the JWT-scoped client with owner-only RLS.
   */
  async updateSettings(
    userId: string,
    patch: UpdateUserSettingsInput,
  ): Promise<UserSettings> {
    const currentUser = await this.#fetchCurrentUser();
    if (currentUser.id !== userId) {
      throw new BusinessException(
        ERROR_DEFINITIONS.USER_SETTINGS_UPDATE_FAILED,
        undefined,
        { operation: 'user.updateSettings', userId },
      );
    }

    const currentMetadata = currentUser.user_metadata ?? {};
    let locale = await this.#findLocale(currentUser);
    let updatedMetadata = currentMetadata;
    if (
      patch.payDayOfMonth !== undefined ||
      patch.currency !== undefined ||
      patch.showCurrencySelector !== undefined
    ) {
      updatedMetadata = await this.#updateLegacySettings(
        userId,
        currentMetadata,
        patch,
      );
    }

    if (patch.locale !== undefined) {
      locale = await this.#upsertLocale(userId, patch.locale);
    }

    return this.#toUserSettings(updatedMetadata, locale);
  }

  async #updateLegacySettings(
    userId: string,
    current: SupabaseUserMetadata,
    patch: UpdateUserSettingsInput,
  ): Promise<SupabaseUserMetadata> {
    const merged: SupabaseUserMetadata = {
      ...current,
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
    return (data.user as SupabaseUserShape).user_metadata ?? current;
  }

  /**
   * Schedule deletion via the service-role admin API. Idempotent: if the user
   * already has `scheduledDeletionAt`, returns it without writing.
   */
  async scheduleDeletion(
    userId: string,
  ): Promise<{ scheduledDeletionAt: string; alreadyScheduled: boolean }> {
    const currentMetadata = this.#normalizeAppMetadata(
      (await this.#fetchCurrentUser()).app_metadata,
    );
    const existing = currentMetadata.scheduledDeletionAt;
    if (typeof existing === 'string' && existing.length > 0) {
      return { scheduledDeletionAt: existing, alreadyScheduled: true };
    }

    const serviceClient = this.supabaseService.getServiceRoleClient();
    const scheduledDeletionAt = new Date().toISOString();
    const { error } = await serviceClient.auth.admin.updateUserById(userId, {
      app_metadata: { ...currentMetadata, scheduledDeletionAt },
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

  async #fetchCurrentUser(): Promise<SupabaseUserShape> {
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

    return data.user as SupabaseUserShape;
  }

  async #findLocale(user: SupabaseUserShape) {
    const { data, error } = await this.authenticatedProvider.client
      .from('user_locale_preference')
      .select('locale')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.USER_FETCH_FAILED,
        undefined,
        { operation: 'user.findLocale' },
        { cause: error },
      );
    }

    return this.#parseLocale(data?.locale ?? user.user_metadata?.locale);
  }

  async #upsertLocale(
    userId: string,
    locale: NonNullable<UserSettings['locale']>,
  ) {
    const { data, error } = await this.authenticatedProvider.client
      .from('user_locale_preference')
      .upsert({ user_id: userId, locale }, { onConflict: 'user_id' })
      .select('locale')
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.USER_SETTINGS_UPDATE_FAILED,
        undefined,
        { operation: 'user.updateLocale', userId },
        { cause: error },
      );
    }

    return this.#parseLocale(data.locale);
  }

  #normalizeAppMetadata(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
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

  #toUserSettings(
    metadata: SupabaseUserMetadata | undefined,
    locale: UserSettings['locale'],
  ): UserSettings {
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
      ...(locale !== undefined && { locale }),
    };
  }

  #parseLocale(rawLocale: unknown): UserSettings['locale'] {
    if (rawLocale === undefined) return undefined;

    const parsedLocale = supportedLocaleSchema.safeParse(rawLocale);
    if (!parsedLocale.success) {
      this.logger.warn(
        { rawLocale },
        'Invalid persisted locale, ignoring server preference',
      );
      return undefined;
    }
    return parsedLocale.data;
  }
}
