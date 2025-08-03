import { Result } from '@shared/domain/result';
import { EnhancedLoggerService } from './enhanced-logger.service';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';

/**
 * Base repository with logging and error handling capabilities
 * Provides common patterns for query and command execution
 */
export abstract class BaseRepository {
  protected client?: AuthenticatedSupabaseClient;

  constructor(
    protected readonly logger: EnhancedLoggerService,
    protected readonly repositoryName: string,
  ) {}

  /**
   * Execute a query operation with logging and error handling
   */
  protected async executeQuery<T>(
    operation: string,
    context: Record<string, any>,
    queryFn: (client: AuthenticatedSupabaseClient) => Promise<Result<T>>,
  ): Promise<Result<T>> {
    if (!this.client) {
      const error = new Error(
        'Supabase client not set. Call setClient() first.',
      );
      this.logger.error(
        { operation, repositoryName: this.repositoryName, ...context },
        error.message,
      );
      return Result.fail(error);
    }

    const operationId = this.logger.startOperation(
      `${this.repositoryName}.${operation}`,
      {
        repositoryName: this.repositoryName,
        ...context,
      },
    );

    try {
      const result = await queryFn(this.client);

      if (result.isSuccess) {
        this.logger.completeOperation(operationId, {
          success: true,
        });
      } else {
        this.logger.completeOperation(operationId, {
          success: false,
          error: result.getError(),
        });
      }

      return result;
    } catch {
      this.logger.error(
        {
          operation,
          repositoryName: this.repositoryName,
          ...context,
          operationId,
        },
        `Unexpected error in ${operation}`,
      );
      return Result.fail(error as Error);
    }
  }

  /**
   * Execute a command operation with logging and error handling
   */
  protected async executeCommand<T>(
    operation: string,
    context: Record<string, any>,
    commandFn: (client: AuthenticatedSupabaseClient) => Promise<Result<T>>,
  ): Promise<Result<T>> {
    if (!this.client) {
      const error = new Error(
        'Supabase client not set. Call setClient() first.',
      );
      this.logger.error(
        { operation, repositoryName: this.repositoryName, ...context },
        error.message,
      );
      return Result.fail(error);
    }

    const operationId = this.logger.startOperation(
      `${this.repositoryName}.${operation}`,
      {
        repositoryName: this.repositoryName,
        type: 'command',
        ...context,
      },
    );

    try {
      const result = await commandFn(this.client);

      if (result.isSuccess) {
        this.logger.completeOperation(operationId, {
          success: true,
        });
        this.logger.logAudit(operation, context, {
          repositoryName: this.repositoryName,
          userId: this.client.auth.getUser().then((u) => u.data?.user?.id),
        });
      } else {
        this.logger.completeOperation(operationId, {
          success: false,
          error: result.getError(),
        });
      }

      return result;
    } catch {
      this.logger.error(
        {
          operation,
          repositoryName: this.repositoryName,
          type: 'command',
          ...context,
          operationId,
        },
        `Unexpected error in command ${operation}`,
      );
      return Result.fail(error as Error);
    }
  }

  /**
   * Set the Supabase client for this repository
   * Must be called before any operations
   */
  abstract setClient(client: AuthenticatedSupabaseClient): void;
}
