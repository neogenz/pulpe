/**
 * Signal testing utilities for Angular components with required signal inputs.
 *
 * WORKAROUND: Required due to Angular issue #54039.
 * Components with required signal inputs and computed() fields cannot be tested
 * with public APIs (setInput, inputBinding, TestHost wrapper) when using
 * zoneless change detection. The computed() signals are evaluated during
 * field initialization, BEFORE template bindings are applied.
 *
 * @see https://github.com/angular/angular/issues/54039
 *
 * TODO: Remove this file and migrate to public APIs when Angular provides a fix.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Internal API required for testing signal inputs with zoneless CD
import { SIGNAL, signalSetFn } from '@angular/core/primitives/signals';
import type { InputSignal } from '@angular/core';

/**
 * Sets a required signal input value for testing.
 *
 * Use this instead of `fixture.componentRef.setInput()` when testing components
 * that have required signal inputs AND computed() fields that depend on them.
 *
 * @example
 * ```typescript
 * // Instead of:
 * signalSetFn(component.item[SIGNAL], mockItem);
 *
 * // Use:
 * setTestInput(component.item, mockItem);
 * ```
 *
 * @param inputSignal - The component's input signal (e.g., `component.item`)
 * @param value - The value to set
 */
export function setTestInput<T>(inputSignal: InputSignal<T>, value: T): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signalSetFn((inputSignal as any)[SIGNAL], value);
}
