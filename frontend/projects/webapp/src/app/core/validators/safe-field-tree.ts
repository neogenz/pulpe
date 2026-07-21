import type { FieldTree } from '@angular/forms/signals';

// Angular's RuntimeError keeps the NGxxxx code in error.message even in
// production builds; safe-field-tree.spec.ts locks this contract.
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
