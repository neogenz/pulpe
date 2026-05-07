import { Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { v4 as uuidv4 } from 'uuid';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { Session, User } from '@supabase/supabase-js';
import { SupabaseService } from '@modules/supabase/supabase.service';
import type { DemoCredentialsPort } from '../../domain/ports/demo-credentials.port';

@Injectable()
export class SupabaseDemoCredentialsAdapter implements DemoCredentialsPort {
  constructor(
    private readonly supabaseService: SupabaseService,
    @InjectInfoLogger(SupabaseDemoCredentialsAdapter.name)
    private readonly logger: InfoLogger,
  ) {}

  generateCredentials(): { email: string; password: string } {
    return {
      email: `demo-${uuidv4()}@pulpe.app`,
      password: uuidv4(),
    };
  }

  async createDemoUser(
    email: string,
    password: string,
  ): Promise<{ userId: string; user: User }> {
    const adminClient = this.supabaseService.getServiceRoleClient();

    const { data: authData, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          is_demo: true,
          created_at: new Date().toISOString(),
          name: 'Utilisateur de test',
        },
      });

    if (createError || !authData.user) {
      throw new BusinessException(
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        {
          operation: 'createDemoUser',
          step: 'create_user',
          supabaseError: createError,
        },
        { cause: createError },
      );
    }

    this.logger.info(
      { operation: 'createDemoUser', userId: authData.user.id },
      'Demo user created',
    );

    return { userId: authData.user.id, user: authData.user };
  }

  async signInDemoUser(
    email: string,
    password: string,
  ): Promise<{ session: Session; user: User }> {
    const adminClient = this.supabaseService.getServiceRoleClient();

    const { data: signInData, error: signInError } =
      await adminClient.auth.signInWithPassword({ email, password });

    if (signInError || !signInData.session) {
      throw new BusinessException(
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        {
          operation: 'signInDemoUser',
          step: 'sign_in',
          supabaseError: signInError,
        },
        { cause: signInError },
      );
    }

    return { session: signInData.session, user: signInData.user };
  }

  async deleteUser(userId: string): Promise<void> {
    const adminClient = this.supabaseService.getServiceRoleClient();
    await adminClient.auth.admin.deleteUser(userId);
  }

  async listExpiredDemoUsers(
    cutoffTime: Date,
    throwOnError: boolean,
  ): Promise<{ id: string; email: string }[]> {
    const adminClient = this.supabaseService.getServiceRoleClient();
    const perPage = 1000;
    let page = 1;
    const expiredUsers: { id: string; email: string }[] = [];

    while (true) {
      const { data, error } = await adminClient.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        if (throwOnError) {
          throw error;
        }

        this.logger.warn(
          { err: error, page },
          'Failed to list users for cleanup',
        );
        break;
      }

      const usersOnPage = data?.users ?? [];

      for (const user of usersOnPage) {
        if (user.user_metadata?.is_demo !== true) continue;
        const createdAt = new Date(user.created_at);
        if (createdAt < cutoffTime) {
          expiredUsers.push({ id: user.id, email: user.email ?? '' });
        }
      }

      if (usersOnPage.length < perPage) break;

      page += 1;
    }

    return expiredUsers;
  }

  async bulkDeleteUsers(userIds: string[]): Promise<{
    fulfilled: string[];
    rejected: { userId: string; reason: string }[];
  }> {
    const adminClient = this.supabaseService.getServiceRoleClient();

    const results = await Promise.allSettled(
      userIds.map(async (userId) => {
        const { error } = await adminClient.auth.admin.deleteUser(userId);
        if (error) throw error;
        return userId;
      }),
    );

    const fulfilled: string[] = [];
    const rejected: { userId: string; reason: string }[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const userId = userIds[i];
      if (result.status === 'fulfilled') {
        fulfilled.push(userId);
      } else {
        rejected.push({
          userId,
          reason:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        });
      }
    }

    return { fulfilled, rejected };
  }
}
