import { describe, expect, it, mock, beforeEach } from 'bun:test';
import { BaseSupabaseRepository } from './base-repository';
import { BaseEntity } from '../../domain/base-entity';
import { Result } from '../../domain/result';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

// Test entity
class TestEntity extends BaseEntity<{ name: string; age: number }> {
  get name(): string {
    return this.props.name;
  }

  get age(): number {
    return this.props.age;
  }

  static create(props: { name: string; age: number }, id?: string): TestEntity {
    return new TestEntity(props, id);
  }
}

// Test repository
class TestRepository extends BaseSupabaseRepository<TestEntity, Database> {
  protected tableName = 'test_table' as const;

  protected toDomain(raw: any): TestEntity {
    return TestEntity.create(
      {
        name: raw.name,
        age: raw.age,
      },
      raw.id,
    );
  }

  protected toPersistence(entity: TestEntity): any {
    return {
      id: entity.id,
      name: entity.name,
      age: entity.age,
      created_at: entity.createdAt.toISOString(),
      updated_at: entity.updatedAt.toISOString(),
    };
  }
}

describe('BaseSupabaseRepository', () => {
  let repository: TestRepository;
  let mockSupabaseClient: any;
  let mockLogger: any;

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      info: mock(() => {}),
      error: mock(() => {}),
      warn: mock(() => {}),
      debug: mock(() => {}),
    };

    // Create chainable mock that returns itself
    const createChainableMock = () => {
      const chainable: any = {};
      chainable.from = mock(() => chainable);
      chainable.select = mock(() => chainable);
      chainable.eq = mock(() => chainable);
      chainable.single = mock(() =>
        Promise.resolve({ data: null, error: null }),
      );
      chainable.insert = mock(() =>
        Promise.resolve({ data: null, error: null }),
      );
      chainable.update = mock(() => chainable);
      chainable.delete = mock(() => chainable);
      return chainable;
    };

    // Mock Supabase client
    mockSupabaseClient = createChainableMock();

    repository = new TestRepository(
      mockSupabaseClient as SupabaseClient<Database>,
      mockLogger,
    );
  });

  describe('findById', () => {
    it('should find entity by id successfully', async () => {
      const rawData = {
        id: '123',
        name: 'John',
        age: 30,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: rawData,
        error: null,
      });

      const result = await repository.findById('123');

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.id).toBe('123');
      expect(result.value!.name).toBe('John');
      expect(result.value!.age).toBe(30);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('test_table');
      expect(mockSupabaseClient.select).toHaveBeenCalledWith('*');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', '123');
      expect(mockSupabaseClient.single).toHaveBeenCalled();
    });

    it('should return null when entity not found', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      const result = await repository.findById('999');

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should handle database errors', async () => {
      const error = { code: 'DB_ERROR', message: 'Database connection failed' };
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error,
      });

      const result = await repository.findById('123');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database connection failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('save', () => {
    it('should save new entity successfully', async () => {
      const entity = TestEntity.create({ name: 'Jane', age: 25 });
      const persistenceData = {
        id: entity.id,
        name: 'Jane',
        age: 25,
        created_at: entity.createdAt.toISOString(),
        updated_at: entity.updatedAt.toISOString(),
      };

      mockSupabaseClient.insert.mockResolvedValueOnce({
        data: persistenceData,
        error: null,
      });

      const result = await repository.save(entity);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual(entity);
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(persistenceData);
    });

    it('should handle save errors', async () => {
      const entity = TestEntity.create({ name: 'Jane', age: 25 });
      const error = { code: 'UNIQUE_VIOLATION', message: 'Duplicate key' };

      mockSupabaseClient.insert.mockResolvedValueOnce({
        data: null,
        error,
      });

      const result = await repository.save(entity);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Duplicate key');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update existing entity successfully', async () => {
      const entity = TestEntity.create(
        { name: 'Updated Name', age: 35 },
        '123',
      );
      entity.markAsUpdated();

      const persistenceData = {
        id: entity.id,
        name: 'Updated Name',
        age: 35,
        created_at: entity.createdAt.toISOString(),
        updated_at: entity.updatedAt.toISOString(),
      };

      // Set up the chain to return success after eq() is called
      mockSupabaseClient.eq.mockResolvedValueOnce({
        data: persistenceData,
        error: null,
      });

      const result = await repository.update(entity);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual(entity);
      expect(mockSupabaseClient.update).toHaveBeenCalledWith(persistenceData);
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', '123');
    });

    it('should handle update errors', async () => {
      const entity = TestEntity.create(
        { name: 'Updated Name', age: 35 },
        '123',
      );
      const error = { code: 'NOT_FOUND', message: 'Record not found' };

      // Set up the chain to return error after eq() is called
      mockSupabaseClient.eq.mockResolvedValueOnce({
        data: null,
        error,
      });

      const result = await repository.update(entity);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Record not found');
    });
  });

  describe('delete', () => {
    it('should delete entity successfully', async () => {
      // Set up the chain to return success after eq() is called
      mockSupabaseClient.eq.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await repository.delete('123');

      expect(result.isSuccess).toBe(true);
      expect(mockSupabaseClient.delete).toHaveBeenCalled();
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', '123');
    });

    it('should handle delete errors', async () => {
      const error = { code: 'FK_VIOLATION', message: 'Foreign key constraint' };
      // Set up the chain to return error after eq() is called
      mockSupabaseClient.eq.mockResolvedValueOnce({
        data: null,
        error,
      });

      const result = await repository.delete('123');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Foreign key constraint');
    });
  });

  describe('exists', () => {
    it('should return true when entity exists', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: '123' },
        error: null,
      });

      const result = await repository.exists('123');

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should return false when entity does not exist', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      const result = await repository.exists('999');

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(false);
    });
  });
});
