import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TagStore } from './tag-store';
import { TagApi } from './tag-api';
import { Logger } from '@core/logging/logger';
import type { Tag } from 'pulpe-shared';

const mockCache = {
  get: vi.fn().mockReturnValue(null),
  set: vi.fn(),
  has: vi.fn().mockReturnValue(false),
  invalidate: vi.fn(),
  deduplicate: vi.fn((_key: string[], fn: () => Promise<unknown>) => fn()),
  prefetch: vi.fn((_key: string[], fn: () => Promise<unknown>) => fn()),
  clear: vi.fn(),
  clearDirty: vi.fn(),
  version: signal(0),
  _dataVersion: signal(0),
};

const mockTags: Tag[] = [
  {
    id: 'tag-1',
    userId: 'user-1',
    name: 'Courses',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'tag-2',
    userId: 'user-1',
    name: 'Loisirs',
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  },
];

const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

describe('TagStore', () => {
  let store: TagStore;
  let mockApi: Partial<TagApi>;

  beforeEach(() => {
    mockCache.version.set(0);
    mockCache._dataVersion.set(0);
    mockCache.get.mockReturnValue(null);
    mockCache.set.mockClear();
    mockCache.invalidate.mockClear();
    mockCache.clear.mockReset();
    mockCache.clear.mockImplementation(() => {
      mockCache.version.update((version) => version + 1);
      mockCache._dataVersion.update((version) => version + 1);
    });
    mockCache.deduplicate.mockImplementation(
      (_key: string[], fn: () => Promise<unknown>) => fn(),
    );

    mockApi = {
      getAll$: vi.fn().mockReturnValue(of({ data: mockTags, success: true })),
      create$: vi.fn(),
      cache: mockCache as unknown as TagApi['cache'],
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        TagStore,
        { provide: TagApi, useValue: mockApi },
        { provide: Logger, useValue: { error: vi.fn() } },
      ],
    });

    store = TestBed.inject(TagStore);
  });

  describe('tags list', () => {
    it('should load tags from the API', async () => {
      await settle();

      expect(store.tags.value()).toEqual(mockTags);
    });

    it('should expose a tag-name-by-id lookup', async () => {
      await settle();

      expect(store.tagNameById().get('tag-1')).toBe('Courses');
      expect(store.tagNameById().get('tag-2')).toBe('Loisirs');
    });

    it('should reload the root resource after the tags cache is cleared', async () => {
      await settle();
      const nextSessionTags = [
        {
          ...mockTags[0],
          id: 'tag-session-b',
          userId: 'user-2',
          name: 'Session B',
        },
      ];
      vi.mocked(mockApi.getAll$!).mockReturnValue(
        of({ data: nextSessionTags, success: true }),
      );

      mockCache.clear();
      await settle();

      expect(mockApi.getAll$).toHaveBeenCalledTimes(2);
      expect(store.tags.value()).toEqual(nextSessionTags);
      expect(store.tagNameById().has('tag-1')).toBe(false);
    });
  });

  describe('addTag', () => {
    it('should create a tag and append it to the list', async () => {
      const created: Tag = {
        id: 'tag-3',
        userId: 'user-1',
        name: 'Santé',
        createdAt: '2024-01-03T00:00:00.000Z',
        updatedAt: '2024-01-03T00:00:00.000Z',
      };
      mockApi.create$ = vi
        .fn()
        .mockReturnValue(of({ data: created, success: true }));

      await settle();

      const result = await store.addTag('Santé');

      expect(result).toEqual(created);
      expect(mockApi.create$).toHaveBeenCalledWith({ name: 'Santé' });
      expect(store.tags.value()?.some((tag) => tag.id === 'tag-3')).toBe(true);
    });

    it('should return undefined when creation fails', async () => {
      mockApi.create$ = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('conflict')));

      await settle();

      const result = await store.addTag('Courses');

      expect(result).toBeUndefined();
    });
  });
});
