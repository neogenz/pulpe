import { type WritableSignal, signal } from '@angular/core';

export interface TemplateDetailsState {
  readonly templateId: WritableSignal<string | null>;
  readonly error: WritableSignal<string | null>;
}

export function createInitialTemplateDetailsState(): TemplateDetailsState {
  return {
    templateId: signal<string | null>(null),
    error: signal<string | null>(null),
  };
}
