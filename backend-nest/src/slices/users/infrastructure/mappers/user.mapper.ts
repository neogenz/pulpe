import { Injectable } from '@nestjs/common';
import { User } from '../../domain/entities/user.entity';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { User as ApiUser, UpdateProfileRequest } from '@pulpe/shared';

@Injectable()
export class UserMapper {
  /**
   * Maps Supabase Auth User to domain entity
   */
  fromSupabaseAuth(supabaseUser: SupabaseUser): User {
    const userResult = User.create(
      {
        email: supabaseUser.email!,
        firstName:
          supabaseUser.user_metadata?.firstName ||
          supabaseUser.user_metadata?.first_name,
        lastName:
          supabaseUser.user_metadata?.lastName ||
          supabaseUser.user_metadata?.last_name,
        onboardingCompleted:
          supabaseUser.user_metadata?.onboardingCompleted === true,
        metadata: supabaseUser.user_metadata,
      },
      supabaseUser.id,
    );

    if (userResult.isFail()) {
      throw new Error(
        `Failed to create user from Supabase auth: ${userResult.error.message}`,
      );
    }

    return userResult.value;
  }

  /**
   * Maps AuthenticatedUser to domain entity
   */
  fromAuthenticatedUser(authUser: AuthenticatedUser): User {
    const userResult = User.create(
      {
        email: authUser.email,
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        onboardingCompleted: authUser.onboardingCompleted || false,
        metadata: {},
      },
      authUser.id,
    );

    if (userResult.isFail()) {
      throw new Error(
        `Failed to create user from authenticated user: ${userResult.error.message}`,
      );
    }

    return userResult.value;
  }

  /**
   * Maps domain entity to API response format
   */
  toApi(user: User): ApiUser {
    const snapshot = user.toSnapshot();
    return {
      id: snapshot.id,
      email: snapshot.email,
      ...(snapshot.firstName && { firstName: snapshot.firstName }),
      ...(snapshot.lastName && { lastName: snapshot.lastName }),
    };
  }

  /**
   * Maps update profile request to domain format
   */
  fromUpdateProfileDto(dto: UpdateProfileRequest) {
    return {
      firstName: dto.firstName,
      lastName: dto.lastName,
    };
  }

  /**
   * Maps metadata for Supabase Auth update
   */
  toSupabaseMetadata(user: User): Record<string, any> {
    const snapshot = user.toSnapshot();
    return {
      firstName: snapshot.firstName,
      lastName: snapshot.lastName,
      onboardingCompleted: snapshot.onboardingCompleted,
      ...snapshot.metadata,
    };
  }
}
