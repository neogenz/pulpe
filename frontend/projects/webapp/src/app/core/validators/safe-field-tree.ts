import type { FieldTree } from '@angular/forms/signals';

export function safeFieldTreeRead<T>(
  read: () => FieldTree<T>,
): FieldTree<T> | null {
  try {
    return read();
  } catch (error) {
    if (error instanceof Error && error.message.includes('NG0950')) return null;
    throw error;
  }
}
