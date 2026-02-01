/**
 * Generic entity updaters for immutable state transformations.
 * Pattern: Redux-like pure functions (items, payload) => newItems
 */

export function addEntity<T>(items: T[], entity: T): T[] {
  return [...items, entity];
}

export function replaceEntity<T extends { id: string }>(
  items: T[],
  oldId: string,
  newEntity: T,
): T[] {
  return items.map((item) => (item.id === oldId ? newEntity : item));
}

export function updateEntity<T extends { id: string }>(
  items: T[],
  id: string,
  updates: Partial<T>,
): T[] {
  return items.map((item) => (item.id === id ? { ...item, ...updates } : item));
}

export function removeEntity<T extends { id: string }>(
  items: T[],
  id: string,
): T[] {
  return items.filter((item) => item.id !== id);
}
