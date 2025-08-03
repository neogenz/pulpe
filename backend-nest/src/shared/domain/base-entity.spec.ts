import { describe, expect, it } from 'bun:test';
import { BaseEntity } from './base-entity';

// Test implementation
class TestEntity extends BaseEntity<{ name: string }> {
  get name(): string {
    return this.props.name;
  }

  static create(props: { name: string }, id?: string): TestEntity {
    return new TestEntity(props, id);
  }
}

describe('BaseEntity', () => {
  describe('creation', () => {
    it('should create entity with generated id when no id provided', () => {
      const entity = TestEntity.create({ name: 'Test' });

      expect(entity.id).toBeDefined();
      expect(entity.id).toBeString();
      expect(entity.id.length).toBeGreaterThan(0);
    });

    it('should create entity with provided id', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      const entity = TestEntity.create({ name: 'Test' }, id);

      expect(entity.id).toBe(id);
    });

    it('should set createdAt and updatedAt on creation', () => {
      const before = new Date();
      const entity = TestEntity.create({ name: 'Test' });
      const after = new Date();

      expect(entity.createdAt).toBeInstanceOf(Date);
      expect(entity.updatedAt).toBeInstanceOf(Date);
      expect(entity.createdAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(entity.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(entity.createdAt).toEqual(entity.updatedAt);
    });
  });

  describe('equality', () => {
    it('should be equal when ids are the same', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      const entity1 = TestEntity.create({ name: 'Test 1' }, id);
      const entity2 = TestEntity.create({ name: 'Test 2' }, id);

      expect(entity1.equals(entity2)).toBe(true);
    });

    it('should not be equal when ids are different', () => {
      const entity1 = TestEntity.create({ name: 'Test' });
      const entity2 = TestEntity.create({ name: 'Test' });

      expect(entity1.equals(entity2)).toBe(false);
    });

    it('should not be equal to undefined', () => {
      const entity = TestEntity.create({ name: 'Test' });

      expect(entity.equals(undefined)).toBe(false);
    });

    it('should not be equal to null', () => {
      const entity = TestEntity.create({ name: 'Test' });

      expect(entity.equals(null as any)).toBe(false);
    });

    it('should not be equal to different entity type with same id', () => {
      class OtherEntity extends BaseEntity<{ value: number }> {
        static create(props: { value: number }, id?: string): OtherEntity {
          return new OtherEntity(props, id);
        }
      }

      const id = '123e4567-e89b-12d3-a456-426614174000';
      const entity1 = TestEntity.create({ name: 'Test' }, id);
      const entity2 = OtherEntity.create({ value: 42 }, id);

      expect(entity1.equals(entity2 as any)).toBe(false);
    });
  });

  describe('update tracking', () => {
    it('should update updatedAt when markAsUpdated is called', async () => {
      const entity = TestEntity.create({ name: 'Test' });
      const originalUpdatedAt = entity.updatedAt;

      // Wait a bit to ensure time difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      entity.markAsUpdated();

      expect(entity.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );
      expect(entity.createdAt).toEqual(originalUpdatedAt);
    });
  });
});
