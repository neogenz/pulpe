import { describe, it, expect } from 'vitest';
import {
  addEntity,
  replaceEntity,
  updateEntity,
  removeEntity,
} from './entity-updaters';

interface TestEntity {
  id: string;
  name: string;
  updatedAt?: string;
}

describe('addEntity', () => {
  it('should add entity to empty array', () => {
    const entity: TestEntity = { id: '1', name: 'Test' };
    const result = addEntity([], entity);
    expect(result).toEqual([entity]);
  });

  it('should add entity to existing array', () => {
    const existing: TestEntity[] = [{ id: '1', name: 'First' }];
    const newEntity: TestEntity = { id: '2', name: 'Second' };
    const result = addEntity(existing, newEntity);
    expect(result).toEqual([...existing, newEntity]);
  });

  it('should return new array (immutable)', () => {
    const existing: TestEntity[] = [{ id: '1', name: 'First' }];
    const result = addEntity(existing, { id: '2', name: 'Second' });
    expect(result).not.toBe(existing);
  });
});

describe('replaceEntity', () => {
  it('should replace matching entity', () => {
    const items: TestEntity[] = [
      { id: '1', name: 'First' },
      { id: '2', name: 'Second' },
    ];
    const newEntity: TestEntity = { id: '2', name: 'Updated' };
    const result = replaceEntity(items, '1', newEntity);
    expect(result).toEqual([newEntity, { id: '2', name: 'Second' }]);
  });

  it('should return unchanged content if not found', () => {
    const items: TestEntity[] = [{ id: '1', name: 'First' }];
    const result = replaceEntity(items, '999', { id: '2', name: 'New' });
    expect(result).toEqual(items);
  });

  it('should return new array when replaced (immutable)', () => {
    const items: TestEntity[] = [{ id: '1', name: 'First' }];
    const result = replaceEntity(items, '1', { id: '2', name: 'New' });
    expect(result).not.toBe(items);
  });
});

describe('updateEntity', () => {
  it('should update matching entity', () => {
    const items: TestEntity[] = [
      { id: '1', name: 'First' },
      { id: '2', name: 'Second' },
    ];
    const result = updateEntity(items, '1', { name: 'Updated' });
    expect(result[0]).toMatchObject({ id: '1', name: 'Updated' });
  });

  it('should return unchanged content if not found', () => {
    const items: TestEntity[] = [{ id: '1', name: 'First' }];
    const result = updateEntity(items, '999', { name: 'Updated' });
    expect(result).toEqual(items);
  });

  it('should return new array when updated (immutable)', () => {
    const items: TestEntity[] = [{ id: '1', name: 'First' }];
    const result = updateEntity(items, '1', { name: 'Updated' });
    expect(result).not.toBe(items);
  });
});

describe('removeEntity', () => {
  it('should remove matching entity', () => {
    const items: TestEntity[] = [
      { id: '1', name: 'First' },
      { id: '2', name: 'Second' },
    ];
    const result = removeEntity(items, '1');
    expect(result).toEqual([{ id: '2', name: 'Second' }]);
  });

  it('should return unchanged content if not found', () => {
    const items: TestEntity[] = [{ id: '1', name: 'First' }];
    const result = removeEntity(items, '999');
    expect(result).toEqual(items);
  });

  it('should return new array when removed (immutable)', () => {
    const items: TestEntity[] = [{ id: '1', name: 'First' }];
    const result = removeEntity(items, '1');
    expect(result).not.toBe(items);
  });
});
