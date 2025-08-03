import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SupabaseClient } from '@supabase/supabase-js';
import { Result } from '@/shared/domain/result';
import { ErrorHandler } from '../utils/error-handler';
import {
  EntityNotFoundException,
  ValidationException,
  ConflictException,
  BusinessRuleViolationException,
  InvalidOperationException,
  MissingDataException,
} from '@/shared/domain/exceptions/domain.exception';

/**
 * Example service demonstrating comprehensive error handling patterns
 * This shows best practices for error handling in NestJS services
 */
@Injectable()
export class ExampleService {
  private readonly errorHandler: ErrorHandler;

  constructor(
    @InjectPinoLogger(ExampleService.name)
    private readonly logger: PinoLogger,
    private readonly supabase: SupabaseClient,
  ) {
    this.errorHandler = ErrorHandler.forService(ExampleService.name, logger);
  }

  /**
   * Example 1: Basic try-catch with domain exceptions
   */
  async findUserById(userId: string): Promise<User> {
    try {
      this.logger.info(
        { operation: 'findUserById', userId },
        'Finding user by ID',
      );

      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        throw new EntityNotFoundException('User', userId);
      }

      this.logger.info(
        { operation: 'findUserById', userId },
        'User found successfully',
      );
      return this.mapToUser(data);
    } catch (error) {
      // Domain exceptions are re-thrown as-is
      if (error instanceof EntityNotFoundException) {
        throw error;
      }

      // Unexpected errors are logged and wrapped
      this.logger.error(
        { operation: 'findUserById', userId, err: error },
        'Unexpected error finding user',
      );
      throw new Error('Failed to find user');
    }
  }

  /**
   * Example 2: Using ErrorHandler for automatic logging and error transformation
   */
  async createUser(input: CreateUserInput): Promise<User> {
    return this.errorHandler.handleAsync(
      async () => {
        // Validate input
        if (!input.email || !input.name) {
          throw new ValidationException({
            email: !input.email ? ['Email is required'] : [],
            name: !input.name ? ['Name is required'] : [],
          });
        }

        // Check for duplicates
        const existing = await this.checkUserExists(input.email);
        if (existing) {
          throw new ConflictException('User with this email already exists');
        }

        // Create user in database
        const { data, error } = await this.supabase
          .from('users')
          .insert(input)
          .select()
          .single();

        if (error || !data) {
          throw new Error(
            `Database error: ${error?.message || 'Unknown error'}`,
          );
        }

        return this.mapToUser(data);
      },
      {
        operation: 'createUser',
        metadata: { email: input.email },
      },
    );
  }

  /**
   * Example 3: Using Result pattern for explicit error handling
   */
  async updateUserBalance(
    userId: string,
    amount: number,
  ): Promise<Result<User, Error>> {
    return this.errorHandler.handleResult(
      async () => {
        // Get current user
        const userResult = await this.getUserWithBalance(userId);
        if (userResult.isFailure) {
          return Result.fail(userResult.error);
        }

        const user = userResult.value;

        // Business rule validation
        if (user.balance + amount < 0) {
          return Result.fail(
            new BusinessRuleViolationException(
              'Insufficient balance for this operation',
            ),
          );
        }

        // Update balance
        const { data, error } = await this.supabase
          .from('users')
          .update({ balance: user.balance + amount })
          .eq('id', userId)
          .select()
          .single();

        if (error || !data) {
          return Result.fail(new Error('Failed to update balance'));
        }

        return Result.ok(this.mapToUser(data));
      },
      {
        operation: 'updateUserBalance',
        userId,
        metadata: { amount },
      },
    );
  }

  /**
   * Example 4: Handling database operations with specific error transformation
   */
  async deleteUser(userId: string): Promise<void> {
    await this.errorHandler.handleDatabase(
      async () => {
        // Check if user has active transactions
        const hasActiveTransactions =
          await this.checkActiveTransactions(userId);
        if (hasActiveTransactions) {
          throw new InvalidOperationException(
            'Cannot delete user with active transactions',
          );
        }

        const { error } = await this.supabase
          .from('users')
          .delete()
          .eq('id', userId);

        if (error) {
          throw error;
        }
      },
      'deleteUser',
      { userId },
    );
  }

  /**
   * Example 5: Handling external service calls with timeout
   */
  async syncUserWithExternalService(userId: string): Promise<void> {
    const user = await this.findUserById(userId);

    await this.errorHandler.handleExternalService(
      async () => {
        const response = await fetch('https://api.external.com/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            name: user.name,
          }),
        });

        if (!response.ok) {
          throw new Error(`External API error: ${response.statusText}`);
        }

        return response.json();
      },
      'ExternalUserAPI',
      'syncUser',
      5000, // 5 second timeout
      { userId },
    );
  }

  /**
   * Example 6: Handling multiple operations in parallel
   */
  async bulkUpdateUsers(updates: UserUpdate[]): Promise<BulkUpdateResult> {
    const operations = updates.map((update) => ({
      operation: () => this.updateUser(update.id, update.data),
      context: {
        operation: 'bulkUpdate.updateUser',
        userId: update.id,
      },
      options: {
        rethrow: false, // Don't fail the entire batch on individual errors
      },
    }));

    const results = await this.errorHandler.handleParallel(operations);

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success);

    this.logger.info(
      {
        operation: 'bulkUpdateUsers',
        total: updates.length,
        successful,
        failed: failed.length,
      },
      'Bulk update completed',
    );

    return {
      total: updates.length,
      successful,
      failed: failed.map((r, i) => ({
        userId: updates[i].id,
        error: r.error?.message || 'Unknown error',
      })),
    };
  }

  /**
   * Example 7: Guard pattern with early returns
   */
  async transferBalance(
    fromUserId: string,
    toUserId: string,
    amount: number,
  ): Promise<void> {
    // Input validation
    if (!fromUserId || !toUserId) {
      throw new MissingDataException('userId');
    }

    if (amount <= 0) {
      throw new ValidationException({
        amount: ['Amount must be positive'],
      });
    }

    if (fromUserId === toUserId) {
      throw new InvalidOperationException('Cannot transfer to the same user');
    }

    // Use transaction for atomic operation
    await this.errorHandler.handleAsync(
      async () => {
        // Get both users
        const [fromUser, _toUser] = await Promise.all([
          this.findUserById(fromUserId),
          this.findUserById(toUserId),
        ]);

        // Check balance
        if (fromUser.balance < amount) {
          throw new BusinessRuleViolationException('Insufficient balance');
        }

        // Perform transfer (would use database transaction in real code)
        await Promise.all([
          this.updateBalance(fromUserId, -amount),
          this.updateBalance(toUserId, amount),
        ]);
      },
      {
        operation: 'transferBalance',
        metadata: { fromUserId, toUserId, amount },
      },
    );
  }

  /**
   * Example 8: Nested error handling with context preservation
   */
  async processUserAction(userId: string, action: UserAction): Promise<void> {
    const context = {
      operation: 'processUserAction',
      userId,
      metadata: { actionType: action.type },
    };

    await this.errorHandler.handleAsync(async () => {
      // Validate user exists
      const user = await this.findUserById(userId);

      // Process based on action type
      switch (action.type) {
        case 'UPDATE_PROFILE':
          await this.updateProfile(userId, action.data);
          break;

        case 'DELETE_ACCOUNT':
          if (!user.canDelete) {
            throw new InvalidOperationException('Account cannot be deleted');
          }
          await this.deleteUser(userId);
          break;

        case 'SYNC_EXTERNAL':
          await this.syncUserWithExternalService(userId);
          break;

        default:
          throw new InvalidOperationException(
            `Unknown action type: ${action.type}`,
          );
      }
    }, context);
  }

  // Helper methods

  private mapToUser(
    data: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
  ): User {
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      balance: data.balance || 0,
      canDelete: data.can_delete || false,
    };
  }

  private async checkUserExists(email: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    return !!data;
  }

  private async getUserWithBalance(
    userId: string,
  ): Promise<Result<User, Error>> {
    try {
      const user = await this.findUserById(userId);
      return Result.ok(user);
    } catch (error) {
      return Result.fail(error as Error);
    }
  }

  private async checkActiveTransactions(userId: string): Promise<boolean> {
    const { count } = await this.supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active');

    return (count || 0) > 0;
  }

  private async updateUser(
    userId: string,
    data: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
  ): Promise<User> {
    const { data: updated, error } = await this.supabase
      .from('users')
      .update(data)
      .eq('id', userId)
      .select()
      .single();

    if (error || !updated) {
      throw new Error('Failed to update user');
    }

    return this.mapToUser(updated);
  }

  private async updateBalance(userId: string, amount: number): Promise<void> {
    const { error } = await this.supabase.rpc('update_user_balance', {
      user_id: userId,
      amount_delta: amount,
    });

    if (error) {
      throw new Error(`Failed to update balance: ${error.message}`);
    }
  }

  private async updateProfile(
    userId: string,
    profile: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('users')
      .update(profile)
      .eq('id', userId);

    if (error) {
      throw new Error('Failed to update profile');
    }
  }
}

// Type definitions for the examples
interface User {
  id: string;
  email: string;
  name: string;
  balance: number;
  canDelete: boolean;
}

interface CreateUserInput {
  email: string;
  name: string;
}

interface UserUpdate {
  id: string;

  data: any /* eslint-disable-line @typescript-eslint/no-explicit-any */;
}

interface BulkUpdateResult {
  total: number;
  successful: number;
  failed: Array<{
    userId: string;
    error: string;
  }>;
}

interface UserAction {
  type: 'UPDATE_PROFILE' | 'DELETE_ACCOUNT' | 'SYNC_EXTERNAL';

  data?: any /* eslint-disable-line @typescript-eslint/no-explicit-any */;
}
