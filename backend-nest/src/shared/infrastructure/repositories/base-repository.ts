import type { SupabaseClient } from '@supabase/supabase-js';
import type { PinoLogger } from 'nestjs-pino';
import { BaseEntity } from '../../domain/base-entity';
import { Result } from '../../domain/result';

/**
 * Base repository interface following repository pattern
 * Defines common operations for all repositories
 */
export interface IRepository<T extends BaseEntity<any>> {
  findById(id: string): Promise<Result<T | null>>;
  save(entity: T): Promise<Result<T>>;
  update(entity: T): Promise<Result<T>>;
  delete(id: string): Promise<Result<void>>;
  exists(id: string): Promise<Result<boolean>>;
}

/**
 * Base Supabase repository implementation
 * Provides common CRUD operations with error handling and logging
 */
export abstract class BaseSupabaseRepository<
  T extends BaseEntity<any>,
  DB = any,
> implements IRepository<T>
{
  protected abstract readonly tableName: string;

  constructor(
    protected readonly supabase: SupabaseClient<DB>,
    protected readonly logger: PinoLogger,
  ) {}

  /**
   * Converts raw database record to domain entity
   */
  protected abstract toDomain(
    raw: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
  ): T;

  /**
   * Converts domain entity to database record format
   */
  protected abstract toPersistence(
    entity: T,
  ): any; /* eslint-disable-line @typescript-eslint/no-explicit-any */

  /**
   * Finds an entity by its ID
   */
  async findById(id: string): Promise<Result<T | null>> {
    try {
      this.logger.info('Finding entity by id', {
        operation: 'findById',
        entityId: id,
        table: this.tableName,
      });

      const { data, error } = await (this.supabase as any)
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        // Check if it's a "no rows found" error
        if (error.code === 'PGRST116') {
          this.logger.info('Entity not found', {
            operation: 'findById',
            entityId: id,
            table: this.tableName,
          });
          return Result.ok(null);
        }

        this.logger.error('Error finding entity', {
          operation: 'findById',
          entityId: id,
          table: this.tableName,
          err: error,
        });
        return Result.fail(`Failed to find entity: ${error.message}`);
      }

      const entity = this.toDomain(data);
      return Result.ok(entity);
    } catch {
      this.logger.error('Unexpected error finding entity', {
        operation: 'findById',
        entityId: id,
        table: this.tableName,
        err: error,
      });
      return Result.fail(`Unexpected error: ${error}`);
    }
  }

  /**
   * Saves a new entity
   */
  async save(entity: T): Promise<Result<T>> {
    try {
      this.logger.info('Saving entity', {
        operation: 'save',
        entityId: entity.id,
        table: this.tableName,
      });

      const data = this.toPersistence(entity);
      const { error } = await (this.supabase as any)
        .from(this.tableName)
        .insert(data);

      if (error) {
        this.logger.error('Error saving entity', {
          operation: 'save',
          entityId: entity.id,
          table: this.tableName,
          err: error,
        });
        return Result.fail(`Failed to save entity: ${error.message}`);
      }

      this.logger.info('Entity saved successfully', {
        operation: 'save',
        entityId: entity.id,
        table: this.tableName,
      });
      return Result.ok(entity);
    } catch {
      this.logger.error('Unexpected error saving entity', {
        operation: 'save',
        entityId: entity.id,
        table: this.tableName,
        err: error,
      });
      return Result.fail(`Unexpected error: ${error}`);
    }
  }

  /**
   * Updates an existing entity
   */
  async update(entity: T): Promise<Result<T>> {
    try {
      this.logger.info('Updating entity', {
        operation: 'update',
        entityId: entity.id,
        table: this.tableName,
      });

      const data = this.toPersistence(entity);
      const { error } = await (this.supabase as any)
        .from(this.tableName)
        .update(data)
        .eq('id', entity.id);

      if (error) {
        this.logger.error('Error updating entity', {
          operation: 'update',
          entityId: entity.id,
          table: this.tableName,
          err: error,
        });
        return Result.fail(`Failed to update entity: ${error.message}`);
      }

      this.logger.info('Entity updated successfully', {
        operation: 'update',
        entityId: entity.id,
        table: this.tableName,
      });
      return Result.ok(entity);
    } catch {
      this.logger.error('Unexpected error updating entity', {
        operation: 'update',
        entityId: entity.id,
        table: this.tableName,
        err: error,
      });
      return Result.fail(`Unexpected error: ${error}`);
    }
  }

  /**
   * Deletes an entity by its ID
   */
  async delete(id: string): Promise<Result<void>> {
    try {
      this.logger.info('Deleting entity', {
        operation: 'delete',
        entityId: id,
        table: this.tableName,
      });

      const { error } = await (this.supabase as any)
        .from(this.tableName)
        .delete()
        .eq('id', id);

      if (error) {
        this.logger.error('Error deleting entity', {
          operation: 'delete',
          entityId: id,
          table: this.tableName,
          err: error,
        });
        return Result.fail(`Failed to delete entity: ${error.message}`);
      }

      this.logger.info('Entity deleted successfully', {
        operation: 'delete',
        entityId: id,
        table: this.tableName,
      });
      return Result.ok();
    } catch {
      this.logger.error('Unexpected error deleting entity', {
        operation: 'delete',
        entityId: id,
        table: this.tableName,
        err: error,
      });
      return Result.fail(`Unexpected error: ${error}`);
    }
  }

  /**
   * Checks if an entity exists
   */
  async exists(id: string): Promise<Result<boolean>> {
    try {
      this.logger.info('Checking entity existence', {
        operation: 'exists',
        entityId: id,
        table: this.tableName,
      });

      const { data, error } = await (this.supabase as any)
        .from(this.tableName)
        .select('id')
        .eq('id', id)
        .single();

      if (error) {
        // Check if it's a "no rows found" error
        if (error.code === 'PGRST116') {
          return Result.ok(false);
        }

        this.logger.error('Error checking entity existence', {
          operation: 'exists',
          entityId: id,
          table: this.tableName,
          err: error,
        });
        return Result.fail(`Failed to check existence: ${error.message}`);
      }

      return Result.ok(!!data);
    } catch {
      this.logger.error('Unexpected error checking entity existence', {
        operation: 'exists',
        entityId: id,
        table: this.tableName,
        err: error,
      });
      return Result.fail(`Unexpected error: ${error}`);
    }
  }
}
