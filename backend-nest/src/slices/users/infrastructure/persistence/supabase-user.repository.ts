import { Injectable } from '@nestjs/common';
import { Result } from '@shared/domain/enhanced-result';
import { BaseRepository } from '@shared/infrastructure/logging/base-repository';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { User } from '../../domain/entities/user.entity';
import { UserRepository } from '../../domain/repositories';
import { UserMapper } from '../mappers/user.mapper';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';

@Injectable()
export class SupabaseUserRepository
  extends BaseRepository
  implements UserRepository
{
  constructor(
    protected readonly logger: EnhancedLoggerService,
    private readonly mapper: UserMapper,
  ) {
    super(logger, 'UserRepository');
  }

  async findById(id: string): Promise<Result<User | null>> {
    return this.executeQuery(
      'findById',
      { id },
      async (client: AuthenticatedSupabaseClient) => {
        // Note: We can't directly query other users in Supabase Auth
        // This method will only work for the current authenticated user
        const {
          data: { user },
          error,
        } = await client.auth.getUser();

        if (error) {
          return Result.fail(error);
        }

        if (!user || user.id !== id) {
          return Result.ok(null);
        }

        const domainUser = this.mapper.fromSupabaseAuth(user);
        return Result.ok(domainUser);
      },
    );
  }

  async findByEmail(email: string): Promise<Result<User | null>> {
    return this.executeQuery(
      'findByEmail',
      { email },
      async (_client: AuthenticatedSupabaseClient) => {
        // Note: We can't search users by email in Supabase Auth from client
        // This would require admin API access
        return Result.fail(
          new GenericDomainException(
            'Operation not supported',
            'UNSUPPORTED_OPERATION',
            'Finding users by email requires admin access',
          ),
        );
      },
    );
  }

  async getCurrentUser(): Promise<Result<User>> {
    return this.executeQuery(
      'getCurrentUser',
      {},
      async (client: AuthenticatedSupabaseClient) => {
        const {
          data: { user },
          error,
        } = await client.auth.getUser();

        if (error) {
          return Result.fail(error);
        }

        if (!user) {
          return Result.fail(
            new GenericDomainException(
              'User not authenticated',
              'UNAUTHENTICATED',
              'No authenticated user found',
            ),
          );
        }

        const domainUser = this.mapper.fromSupabaseAuth(user);
        return Result.ok(domainUser);
      },
    );
  }

  async updateProfile(
    userId: string,
    firstName?: string,
    lastName?: string,
  ): Promise<Result<User>> {
    return this.executeQuery(
      'updateProfile',
      { userId, firstName, lastName },
      async (client: AuthenticatedSupabaseClient) => {
        // Get current user data first
        const { data: currentUserData, error: getUserError } =
          await client.auth.getUser();

        if (getUserError || !currentUserData.user) {
          return Result.fail(
            getUserError || new Error('Failed to get current user data'),
          );
        }

        // Update user metadata
        const { data: updatedUser, error } = await client.auth.updateUser({
          data: {
            ...currentUserData.user.user_metadata,
            firstName,
            lastName,
          },
        });

        if (error || !updatedUser.user) {
          return Result.fail(error || new Error('Failed to update user'));
        }

        const domainUser = this.mapper.fromSupabaseAuth(updatedUser.user);
        return Result.ok(domainUser);
      },
    );
  }

  async updateMetadata(
    userId: string,
    metadata: Record<string, any>,
  ): Promise<Result<User>> {
    return this.executeQuery(
      'updateMetadata',
      { userId, metadata },
      async (client: AuthenticatedSupabaseClient) => {
        // Get current user data first
        const { data: currentUserData, error: getUserError } =
          await client.auth.getUser();

        if (getUserError || !currentUserData.user) {
          return Result.fail(
            getUserError || new Error('Failed to get current user data'),
          );
        }

        // Update user metadata
        const { data: updatedUser, error } = await client.auth.updateUser({
          data: {
            ...currentUserData.user.user_metadata,
            ...metadata,
          },
        });

        if (error || !updatedUser.user) {
          return Result.fail(error || new Error('Failed to update user'));
        }

        const domainUser = this.mapper.fromSupabaseAuth(updatedUser.user);
        return Result.ok(domainUser);
      },
    );
  }

  async completeOnboarding(userId: string): Promise<Result<void>> {
    return this.executeQuery(
      'completeOnboarding',
      { userId },
      async (client: AuthenticatedSupabaseClient) => {
        // Get current user data first
        const { data: currentUserData, error: getUserError } =
          await client.auth.getUser();

        if (getUserError || !currentUserData.user) {
          return Result.fail(
            getUserError || new Error('Failed to get current user data'),
          );
        }

        // Update user metadata
        const { error } = await client.auth.updateUser({
          data: {
            ...currentUserData.user.user_metadata,
            onboardingCompleted: true,
            onboardingCompletedAt: new Date().toISOString(),
          },
        });

        if (error) {
          return Result.fail(error);
        }

        return Result.ok();
      },
    );
  }

  async delete(userId: string): Promise<Result<void>> {
    return this.executeQuery(
      'delete',
      { userId },
      async (client: AuthenticatedSupabaseClient) => {
        // Note: Deleting users requires admin API access
        // From the client, we can only sign out the user
        const { error } = await client.auth.signOut();

        if (error) {
          return Result.fail(error);
        }

        this.logger.warn(
          { userId },
          'User signed out. Full deletion requires admin API access.',
        );

        return Result.ok();
      },
    );
  }
}
