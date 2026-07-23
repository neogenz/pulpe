import { signal, type WritableSignal } from '@angular/core';
import { type Tag } from 'pulpe-shared';
import { vi } from 'vitest';

/**
 * Test double for the root `TagStore`. Specs wire it with
 * `{ provide: TagStore, useValue: createMockTagStore(...) }` (only `.spec.ts`
 * files may import `@core/tag`; the `testing` layer may not).
 */
export interface MockTagStore {
  tags: { value: WritableSignal<Tag[]> };
  tagNameById: WritableSignal<Map<string, string>>;
  addTag: ReturnType<typeof vi.fn>;
  ensureLoaded: ReturnType<typeof vi.fn>;
  setTags: (tags: Tag[]) => void;
}

function buildNameMap(tags: Tag[]): Map<string, string> {
  return new Map(tags.map((tag) => [tag.id, tag.name]));
}

export function createMockTagStore(initialTags: Tag[] = []): MockTagStore {
  const tagsValue = signal<Tag[]>(initialTags);
  const tagNameById = signal(buildNameMap(initialTags));
  return {
    tags: { value: tagsValue },
    tagNameById,
    addTag: vi.fn().mockResolvedValue(undefined),
    ensureLoaded: vi.fn().mockResolvedValue(undefined),
    setTags(tags: Tag[]): void {
      tagsValue.set(tags);
      tagNameById.set(buildNameMap(tags));
    },
  };
}
