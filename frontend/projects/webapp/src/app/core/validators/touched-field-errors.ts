import { computed, type Signal } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';

/**
 * Map a signal-forms field's error kinds to booleans, gated on `touched()`.
 *
 * Returned record stays `false` for every kind until the field is touched, so
 * `<mat-error>` blocks only render after user interaction.
 *
 * The `field` argument is a getter to defer FieldTree resolution until first
 * read — eager access during class-field init triggers NG0950 when signal
 * inputs feed validators.
 */
export function touchedFieldErrors<T, K extends string>(
  field: () => FieldTree<T>,
  ...kinds: readonly K[]
): Signal<Record<K, boolean>> {
  return computed(() => {
    const empty = Object.fromEntries(kinds.map((k) => [k, false])) as Record<
      K,
      boolean
    >;
    const state = field()();
    if (!state.touched()) return empty;
    const errors = state.errors();
    return Object.fromEntries(
      kinds.map((k) => [k, errors.some((e) => e.kind === k)]),
    ) as Record<K, boolean>;
  });
}
