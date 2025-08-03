import { Result } from '@shared/domain/enhanced-result';
import { User } from '../entities/user.entity';

export const USER_REPOSITORY_TOKEN = 'UserRepository';

export interface UserRepository {
  /**
   * Find a user by their ID
   */
  findById(id: string): Promise<Result<User | null>>;

  /**
   * Find a user by their email
   */
  findByEmail(email: string): Promise<Result<User | null>>;

  /**
   * Get the current authenticated user
   */
  getCurrentUser(): Promise<Result<User>>;

  /**
   * Update user profile in Supabase Auth
   */
  updateProfile(
    userId: string,
    firstName?: string,
    lastName?: string,
  ): Promise<Result<User>>;

  /**
   * Update user metadata in Supabase Auth
   */
  updateMetadata(
    userId: string,
    metadata: Record<string, any>,
  ): Promise<Result<User>>;

  /**
   * Mark onboarding as completed
   */
  completeOnboarding(userId: string): Promise<Result<void>>;

  /**
   * Delete user account (soft delete in Supabase)
   */
  delete(userId: string): Promise<Result<void>>;
}
